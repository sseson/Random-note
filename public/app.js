// public/app.js
import CONFIG from './config.js';

class RecordsApp {
  constructor() {
    this.apiBase = CONFIG.WORKER_URL + '/api';
    this.token = localStorage.getItem('token');
    this.config = null;
    this.currentPageId = null;
    this.data = {};
    this.isDarkMode = this.getThemePreference();
    
    this.init();
  }

  async init() {
    this.setupTheme();
    this.bindEvents();
    
    if (this.token) {
      await this.verifyToken();
    } else {
      this.showLoginPage();
    }
  }

  // ============ 主题管理 ============

  getThemePreference() {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    
    // 检测系统偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  setupTheme() {
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      document.getElementById('themeIcon').textContent = '☀️';
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.getElementById('themeIcon').textContent = '🌙';
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    this.setupTheme();
  }

  // ============ 认证 ============

  async login(username, password) {
    try {
      const response = await fetch(`${this.apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '登录失败');
      }

      const { token } = await response.json();
      localStorage.setItem('token', token);
      this.token = token;

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async verifyToken() {
    try {
      const response = await fetch(`${this.apiBase}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (response.ok) {
        await this.loadApp();
      } else {
        this.logout();
      }
    } catch (error) {
      this.logout();
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.token = null;
    location.reload();
  }

  // ============ API 调用 ============

  async fetchAPI(endpoint, options = {}) {
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.logout();
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.showMessage(`错误: ${error.message}`, 'error');
      return null;
    }
  }

  // ============ 应用初始化 ============

  async loadApp() {
    this.showAppPage();
    await this.loadConfig();
  }

  showLoginPage() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('appPage').classList.remove('active');
  }

  showAppPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('appPage').classList.add('active');
  }

  // ============ 配置管理 ============

  async loadConfig() {
    const data = await this.fetchAPI('/config');
    if (!data) return;

    this.config = data;
    this.currentPageId = this.config.pages[0]?.id;
    
    this.renderPageTabs();
    await this.loadPageData();
  }

  renderPageTabs() {
    const container = document.getElementById('pageTabs');
    container.innerHTML = '';

    this.config.pages.forEach(page => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${page.id === this.currentPageId ? 'active' : ''}`;
      btn.textContent = page.title;
      btn.onclick = () => this.switchPage(page.id);
      container.appendChild(btn);
    });
  }

  switchPage(pageId) {
    this.currentPageId = pageId;
    this.renderPageTabs();
    this.loadPageData();
  }

  // ============ 数据管理 ============

  async loadPageData() {
    const page = this.config.pages.find(p => p.id === this.currentPageId);
    if (!page) return;

    document.getElementById('pageTitle').textContent = page.title;

    const data = await this.fetchAPI(`/records/${this.currentPageId}`);
    if (data) {
      this.data[this.currentPageId] = data.rows || [];
      this.renderTable(page);
    }
  }

  renderTable(page) {
    const thead = document.getElementById('tableHead');
    const tbody = document.getElementById('tableBody');

    // 渲染表头
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');

    for (let i = 0; i < page.columns; i++) {
      const th = document.createElement('th');
      th.textContent = `列 ${i + 1}`;
      headerRow.appendChild(th);
    }

    const actionTh = document.createElement('th');
    actionTh.textContent = '操作';
    actionTh.style.width = '80px';
    actionTh.style.textAlign = 'center';
    headerRow.appendChild(actionTh);

    thead.appendChild(headerRow);

    // 渲染表体
    tbody.innerHTML = '';
    const rows = this.data[this.currentPageId] || [];

    rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');

      for (let colIndex = 0; colIndex < page.columns; colIndex++) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = row[colIndex] || '';
        td.appendChild(input);
        tr.appendChild(td);
      }

      // 删除按钮
      const actionTd = document.createElement('td');
      actionTd.className = 'actions-cell';
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-delete-row';
      deleteBtn.textContent = '🗑️';
      deleteBtn.onclick = () => this.deleteRow(rowIndex);
      actionTd.appendChild(deleteBtn);
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });
  }

  addRow() {
    const page = this.config.pages.find(p => p.id === this.currentPageId);
    const newRow = new Array(page.columns).fill('');

    if (!this.data[this.currentPageId]) {
      this.data[this.currentPageId] = [];
    }

    this.data[this.currentPageId].push(newRow);
    this.renderTable(page);
  }

  deleteRow(rowIndex) {
    if (confirm('确定要删除这一行吗？')) {
      this.data[this.currentPageId].splice(rowIndex, 1);
      const page = this.config.pages.find(p => p.id === this.currentPageId);
      this.renderTable(page);
    }
  }

  async deleteAllRows() {
    if (confirm('确定要清空所有数据吗？此操作无法撤销！')) {
      this.data[this.currentPageId] = [];
      const page = this.config.pages.find(p => p.id === this.currentPageId);
      this.renderTable(page);
      await this.saveData();
    }
  }

  async saveData() {
    const rows = [];
    document.querySelectorAll('#tableBody tr').forEach(tr => {
      const row = [];
      tr.querySelectorAll('input').forEach(input => {
        row.push(input.value);
      });
      rows.push(row);
    });

    const result = await this.fetchAPI(`/records/${this.currentPageId}`, {
      method: 'POST',
      body: JSON.stringify({ rows })
    });

    if (result?.success) {
      this.showMessage('数据已保存！', 'success');
    }
  }

  // ============ UI 交互 ============

  showMessage(text, type = 'info') {
    const container = document.getElementById('messageContainer');
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    container.appendChild(msg);

    setTimeout(() => msg.remove(), 3000);
  }

  openConfigModal() {
    document.getElementById('configModal').style.display = 'flex';
    this.renderPagesList();
  }

  closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
  }

  renderPagesList() {
    const container = document.getElementById('pagesList');
    container.innerHTML = '';

    this.config.pages.forEach((page, index) => {
      const item = document.createElement('div');
      item.className = 'page-item';
      item.innerHTML = `
        <div class="page-info">
          <h4>${page.title}</h4>
          <p>${page.columns} 列</p>
        </div>
        <button class="btn btn-danger btn-small" onclick="app.deletePage(${index})">
          删除
        </button>
      `;
      container.appendChild(item);
    });
  }

  async addPage(title, columns) {
    const id = Date.now().toString();
    this.config.pages.push({ id, title, columns: parseInt(columns) });

    const result = await this.fetchAPI('/config', {
      method: 'POST',
      body: JSON.stringify(this.config)
    });

    if (result?.success) {
      this.showMessage('页面已添加！', 'success');
      this.loadConfig();
      this.renderPagesList();
    }
  }

  async deletePage(index) {
    if (confirm('确定要删除这个页面吗？')) {
      this.config.pages.splice(index, 1);

      const result = await this.fetchAPI('/config', {
        method: 'POST',
        body: JSON.stringify(this.config)
      });

      if (result?.success) {
        this.showMessage('页面已删除！', 'success');
        this.loadConfig();
      }
    }
  }

  // ============ 事件绑定 ============

  bindEvents() {
    // 登录
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      const result = await this.login(username, password);
      if (result.success) {
        await this.loadApp();
      } else {
        document.getElementById('loginError').textContent = result.error;
        document.getElementById('loginError').style.display = 'block';
      }
    });

    // 主题
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // 配置
    document.getElementById('configBtn').addEventListener('click', () => {
      this.openConfigModal();
    });

    document.getElementById('closeConfigModal').addEventListener('click', () => {
      this.closeConfigModal();
    });

    document.getElementById('modalOverlay').addEventListener('click', () => {
      this.closeConfigModal();
    });

    // 添加页面
    document.getElementById('addPageForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('newPageTitle').value;
      const columns = document.getElementById('newPageColumns').value;
      this.addPage(title, columns);
      e.target.reset();
    });

    // 表格操作
    document.getElementById('addRowBtn').addEventListener('click', () => {
      this.addRow();
    });

    document.getElementById('saveDataBtn').addEventListener('click', () => {
      this.saveData();
    });

    document.getElementById('deleteAllBtn').addEventListener('click', () => {
      this.deleteAllRows();
    });

    // 登出
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });
  }
}

// 启动应用
const app = new RecordsApp();