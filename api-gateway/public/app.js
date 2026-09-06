(() => {
  'use strict';

  const state = {
    token: sessionStorage.getItem('pedidosToken') || '',
    products: [],
    cart: new Map(),
    lastOrder: null
  };

  const $ = (selector) => document.querySelector(selector);

  function formatMoney(value) {
    return Number(value || 0).toFixed(2);
  }

  function correlationFrom(response, body) {
    return response.headers.get('x-correlation-id') || body?.correlationId || 'no-disponible';
  }

  function showMessage(title, text, type = 'info', correlationId = 'no-disponible') {
    const message = $('#operation-message');
    message.className = 'message ' + type;
    $('#operation-title').textContent = title;
    $('#operation-text').textContent = text;
    $('#correlation-id').textContent = correlationId;
  }

  function errorText(result) {
    const body = result.body || {};
    const code = body.code ? ' [' + body.code + ']' : '';
    if (body.details?.stockDisponible !== undefined) {
      return (body.error || 'Operación rechazada') + '. Disponible: ' + body.details.stockDisponible + code;
    }
    return (body.error || 'La operación no pudo completarse') + code;
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(path, { ...options, headers });
    } catch (error) {
      showMessage('Gateway no disponible', error.message, 'error');
      throw error;
    }

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: 'Respuesta no JSON del Gateway' };
      }
    }
    return { response, body, correlationId: correlationFrom(response, body) };
  }

  function updateSession() {
    const badge = $('#auth-badge');
    const loggedIn = Boolean(state.token);
    badge.textContent = loggedIn ? 'JWT activo' : 'Sin sesión';
    badge.className = 'status-pill ' + (loggedIn ? 'success' : 'muted');
    $('#logout').hidden = !loggedIn;
    $('#user-status').textContent = loggedIn
      ? 'Sesión lista. Puedes crear un pedido protegido.'
      : 'Puedes crear una cuenta de demostración o probar un pedido sin JWT para ver el rechazo.';
  }

  function healthCard(name, stateName, detail) {
    const card = document.createElement('div');
    card.className = 'health-card ' + stateName;
    const icon = document.createElement('span');
    icon.className = 'health-icon';
    icon.textContent = stateName === 'success' ? '✓' : stateName === 'loading' ? '…' : '!';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = name;
    const status = document.createElement('small');
    status.textContent = detail;
    copy.append(title, status);
    card.append(icon, copy);
    return card;
  }

  async function refreshHealth() {
    const grid = $('#health-grid');
    grid.replaceChildren(
      healthCard('Gateway', 'loading', 'Consultando…'),
      healthCard('Usuarios', 'loading', 'Consultando…'),
      healthCard('Productos', 'loading', 'Consultando…'),
      healthCard('Pedidos', 'loading', 'Consultando…')
    );

    const checks = [
      { name: 'Gateway', path: '/healthz' },
      { name: 'Usuarios', path: '/api/usuarios/readyz' },
      { name: 'Productos', path: '/api/productos/readyz' },
      { name: 'Pedidos', path: '/api/pedidos/readyz' }
    ];
    const results = await Promise.all(checks.map(async (check) => {
      try {
        const result = await apiFetch(check.path);
        return { ...check, ok: result.response.ok, detail: result.body?.status || 'HTTP ' + result.response.status };
      } catch {
        return { ...check, ok: false, detail: 'Sin conexión' };
      }
    }));

    grid.replaceChildren(...results.map((result) => healthCard(
      result.name,
      result.ok ? 'success' : 'down',
      result.ok ? 'Operativo · ' + result.detail : result.detail
    )));
  }

  function productById(productId) {
    return state.products.find((product) => String(product._id) === String(productId));
  }

  function renderProducts() {
    const grid = $('#products-grid');
    grid.replaceChildren();
    if (!state.products.length) {
      grid.append(Object.assign(document.createElement('div'), {
        className: 'empty-state',
        textContent: 'No hay productos disponibles en este momento.'
      }));
      return;
    }

    state.products.forEach((product) => {
      const card = document.createElement('article');
      card.className = 'product-card';
      const content = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = product.nombre;
      const description = document.createElement('p');
      description.textContent = product.descripcion || 'Producto del catálogo';
      content.append(title, description);

      const meta = document.createElement('div');
      meta.className = 'product-meta';
      const price = document.createElement('span');
      price.className = 'price';
      price.textContent = '$' + formatMoney(product.precio);
      const stock = document.createElement('span');
      stock.className = 'stock' + (product.stock < 1 ? ' empty' : '');
      stock.textContent = product.stock > 0 ? product.stock + ' disponibles' : 'Agotado';
      meta.append(price, stock);

      const action = document.createElement('div');
      action.className = 'product-action';
      const quantity = document.createElement('input');
      quantity.type = 'number';
      quantity.min = '1';
      quantity.value = '1';
      quantity.setAttribute('aria-label', 'Cantidad de ' + product.nombre);
      const add = document.createElement('button');
      add.className = 'button button-secondary';
      add.type = 'button';
      add.textContent = 'Agregar';
      add.disabled = product.stock < 1;
      add.addEventListener('click', () => {
        const amount = Number(quantity.value);
        if (!Number.isInteger(amount) || amount < 1) {
          showMessage('Cantidad inválida', 'Usa una cantidad entera positiva.', 'error');
          return;
        }
        const id = String(product._id);
        state.cart.set(id, (state.cart.get(id) || 0) + amount);
        renderCart();
        showMessage('Producto agregado', product.nombre + ' se agregó al carrito.', 'success');
      });
      action.append(quantity, add);
      card.append(content, meta, action);
      grid.append(card);
    });
  }

  async function loadProducts() {
    try {
      const result = await apiFetch('/api/productos');
      if (!result.response.ok) {
        showMessage('Catálogo no disponible', errorText(result), 'error', result.correlationId);
        return;
      }
      state.products = Array.isArray(result.body) ? result.body : [];
      renderProducts();
    } catch {
      renderProducts();
    }
  }

  function renderCart() {
    const list = $('#cart-list');
    list.replaceChildren();
    let count = 0;
    let total = 0;

    state.cart.forEach((quantity, id) => {
      const product = productById(id);
      if (!product) return;
      count += quantity;
      total += Number(product.precio) * quantity;
      const item = document.createElement('div');
      item.className = 'cart-item';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = product.nombre;
      const detail = document.createElement('small');
      detail.textContent = quantity + ' × $' + formatMoney(product.precio);
      copy.append(title, detail);
      const controls = document.createElement('div');
      controls.className = 'cart-controls';
      const decrease = document.createElement('button');
      decrease.type = 'button';
      decrease.textContent = '−';
      decrease.setAttribute('aria-label', 'Reducir cantidad');
      decrease.addEventListener('click', () => {
        if (quantity <= 1) state.cart.delete(id);
        else state.cart.set(id, quantity - 1);
        renderCart();
      });
      const amount = document.createElement('span');
      amount.textContent = String(quantity);
      const increase = document.createElement('button');
      increase.type = 'button';
      increase.textContent = '+';
      increase.setAttribute('aria-label', 'Aumentar cantidad');
      increase.addEventListener('click', () => {
        state.cart.set(id, quantity + 1);
        renderCart();
      });
      controls.append(decrease, amount, increase);
      item.append(copy, controls);
      list.append(item);
    });

    if (!count) {
      list.append(Object.assign(document.createElement('div'), {
        className: 'empty-state',
        textContent: 'Tu carrito está vacío.'
      }));
    }
    $('#cart-count').textContent = String(count);
    $('#cart-total').textContent = '$' + formatMoney(total);
  }

  async function register(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await apiFetch('/api/usuarios/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre: form.get('nombre'),
        email: form.get('email'),
        password: form.get('password')
      })
    });
    if (!result.response.ok) {
      showMessage('Registro rechazado', errorText(result), 'error', result.correlationId);
      return;
    }
    $('#login-email').value = form.get('email');
    $('#login-password').value = form.get('password');
    showMessage('Usuario registrado', 'Ahora puedes iniciar sesión para obtener el JWT.', 'success', result.correlationId);
    event.currentTarget.reset();
  }

  async function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await apiFetch('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password')
      })
    });
    if (!result.response.ok) {
      showMessage('Login rechazado', errorText(result), 'error', result.correlationId);
      return;
    }
    state.token = result.body.token;
    sessionStorage.setItem('pedidosToken', state.token);
    updateSession();
    showMessage('Sesión iniciada', 'JWT listo para crear pedidos protegidos.', 'success', result.correlationId);
  }

  function orderPayload() {
    return {
      items: [...state.cart].map(([productoId, cantidad]) => ({ productoId, cantidad }))
    };
  }

  async function submitOrder(event, replay = false) {
    if (!replay && !state.cart.size) {
      showMessage('Carrito vacío', 'Agrega al menos un producto antes de crear el pedido.', 'error');
      return;
    }
    const request = replay ? state.lastOrder : { payload: orderPayload(), key: 'web-' + crypto.randomUUID() };
    if (!request) return;
    const headers = {
      'Idempotency-Key': request.key,
      'x-correlation-id': 'web-' + crypto.randomUUID()
    };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;

    const result = await apiFetch('/api/pedidos', {
      method: 'POST',
      headers,
      body: JSON.stringify(request.payload)
    });
    if (!result.response.ok) {
      showMessage('Pedido rechazado', errorText(result), 'error', result.correlationId);
      return;
    }

    state.lastOrder = request;
    $('#repeat-order').hidden = false;
    if (!replay) {
      state.cart.clear();
      renderCart();
      await loadProducts();
    }
    const orderId = result.body?._id ? ' Pedido: ' + result.body._id : '';
    showMessage(
      replay ? 'Replay idempotente' : 'Pedido confirmado',
      (replay ? 'La misma solicitud devolvió el pedido existente.' : 'Pedido creado correctamente.') +
        ' Total: $' + formatMoney(result.body?.total) + '.' + orderId,
      'success',
      result.correlationId
    );
  }

  $('#register-form').addEventListener('submit', register);
  $('#login-form').addEventListener('submit', login);
  $('#logout').addEventListener('click', () => {
    state.token = '';
    sessionStorage.removeItem('pedidosToken');
    updateSession();
    showMessage('Sesión cerrada', 'El próximo pedido se enviará sin JWT.', 'info');
  });
  $('#refresh-health').addEventListener('click', refreshHealth);
  $('#refresh-products').addEventListener('click', loadProducts);
  $('#create-order').addEventListener('click', (event) => submitOrder(event));
  $('#repeat-order').addEventListener('click', (event) => submitOrder(event, true));
  $('#clear-cart').addEventListener('click', () => {
    state.cart.clear();
    renderCart();
    showMessage('Carrito vacío', 'Puedes seleccionar nuevos productos.', 'info');
  });

  updateSession();
  renderCart();
  refreshHealth();
  loadProducts();
})();
