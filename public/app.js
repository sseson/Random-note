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

    thead.innerHTML = '';
    const headerRow = document.createElement('tr');

    for (let i = 0; i < page.columns; i++) {
      const th = document.createElement('th');
      th.textContent = `列 ${i + 1}`;
      headerRow.appendChild(th);
    }

    const actionTh = document.createElement('th');
    actionTh.textContent = '操作';
    actionTh.style.width = '100px';
    actionTh.style.textAlign = 'center';
    headerRow.appendChild(actionTh);

    thead.appendChild(headerRow);

    tbody.innerHTML = '';
    const rows = this.data[this.currentPageId] || [];

    rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      tr.dataset.rowIndex = rowIndex;
      tr.dataset.editing = 'false';

      for (let colIndex = 0; colIndex < page.columns; colIndex++) {
        const td = document.createElement('td');
        td.className = 'data-cell';
        
        // 默认显示为文本（不是输入框）
        const textSpan = document.createElement('span');
        textSpan.className = 'cell-text';
        textSpan.textContent = row[colIndex] || '';
        textSpan.style.display = 'block';
        
        // 隐藏的输入框
        const input = document.createElement('input');
        input.className = 'cell-input';
        input.type = 'text';
        input.value = row[colIndex] || '';
        input.style.display = 'none';
        input.style.width = '100%';
        
        td.appendChild(textSpan);
        td.appendChild(input);
        tr.appendChild(td);
      }

      // 操作按钮
      const actionTd = document.createElement('td');
      actionTd.className = 'actions-cell';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-edit-row';
      editBtn.textContent = '✏️ 编辑';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleRowEdit(tr, rowIndex, page);
      };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-delete-row';
      deleteBtn.textContent = '🗑️';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deleteRow(rowIndex);
      };
      
      actionTd.appendChild(editBtn);
      actionTd.appendChild(deleteBtn);
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });
  }

  toggleRowEdit(tr, rowIndex, page) {
    const isEditing = tr.dataset.editing === 'true';
    const cells = tr.querySelectorAll('.data-cell');
    const editBtn = tr.querySelector('.btn-edit-row');
    
    if (!isEditing) {
      // 进入编辑模式
      cells.forEach(cell => {
        const textSpan = cell.querySelector('.cell-text');
        const input = cell.querySelector('.cell-input');
        textSpan.style.display = 'none';
        input.style.display = 'block';
        input.focus();
      });
      tr.dataset.editing = 'true';
    } else {
      // 退出编辑模式
      cells.forEach((cell, colIndex) => {
        const textSpan = cell.querySelector('.cell-text');
        const input = cell.querySelector('.cell-input');
        
        const newValue = input.value;
        this.data[this.currentPageId][rowIndex][colIndex] = newValue;
        textSpan.textContent = newValue;
        
        textSpan.style.display = 'block';
        input.style.display = 'none';
      });
      tr.dataset.editing = 'false';
    }
  }

  addRow() {
    const page = this.config.pages.find(p => p.id === this.currentPageId);
    const newRow = new Array(page.columns).fill('');

    if (!this.data[this.currentPageId]) {
      this.data[this.currentPageId] = [];
    }

    this.data[this.currentPageId].push(newRow);
    this.renderTable(page);
    
    // ✅ 新添加的行自动进入编辑状态
    const tbody = document.getElementById('tableBody');
    const lastRow = tbody.lastElementChild;
    if (lastRow) {
      lastRow.dataset.editing = 'false';
      this.toggleRowEdit(lastRow, this.data[this.currentPageId].length - 1, page);
    }
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
      await this.loadPageData();
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
      item.dataset.pageIndex = index;
      item.dataset.editing = 'false';
      
      const pageInfo = document.createElement('div');
      pageInfo.className = 'page-info';
      
      // 显示模式
      const titleDisplay = document.createElement('h4');
      titleDisplay.className = 'page-title-display';
      titleDisplay.textContent = page.title;
      titleDisplay.style.display = 'block';
      
      const columnsDisplay = document.createElement('p');
      columnsDisplay.className = 'page-columns-display';
      columnsDisplay.textContent = `${page.columns} 列`;
      columnsDisplay.style.display = 'block';
      
      // 编辑模式
      const titleInput = document.createElement('input');
      titleInput.className = 'page-title-input';
      titleInput.type = 'text';
      titleInput.value = page.title;
      titleInput.style.display = 'none';
      titleInput.placeholder = '页面标题';
      
      const columnsInput = document.createElement('input');
      columnsInput.className = 'page-columns-input';
      columnsInput.type = 'number';
      columnsInput.value = page.columns;
      columnsInput.min = '1';
      columnsInput.max = '20';
      columnsInput.style.display = 'none';
      columnsInput.placeholder = '列数';
      
      pageInfo.appendChild(titleDisplay);
      pageInfo.appendChild(columnsDisplay);
      pageInfo.appendChild(titleInput);
      pageInfo.appendChild(columnsInput);
      
      // 按钮容器
      const btnContainer = document.createElement('div');
      btnContainer.className = 'page-buttons';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-edit-page';
      editBtn.textContent = '✏️ 编辑';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        this.togglePageEdit(item, index);
      };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-small';
      deleteBtn.textContent = '🗑️ 删除';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deletePage(index);
      };
      
      btnContainer.appendChild(editBtn);
      btnContainer.appendChild(deleteBtn);
      
      item.appendChild(pageInfo);
      item.appendChild(btnContainer);
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
      this.renderPagesList();
      this.renderPageTabs();  // 更新首页的页面选项卡
    }
  }

  togglePageEdit(item, index) {
    const isEditing = item.dataset.editing === 'true';
    const editBtn = item.querySelector('.btn-edit-page');
    const titleDisplay = item.querySelector('.page-title-display');
    const columnsDisplay = item.querySelector('.page-columns-display');
    const titleInput = item.querySelector('.page-title-input');
    const columnsInput = item.querySelector('.page-columns-input');
    
    if (!isEditing) {
      // 进入编辑模式
      titleDisplay.style.display = 'none';
      columnsDisplay.style.display = 'none';
      titleInput.style.display = 'block';
      columnsInput.style.display = 'block';
      editBtn.textContent = '✅ 保存';
      item.dataset.editing = 'true';
      titleInput.focus();
    } else {
      // 退出编辑模式，直接保存到服务器
      const newTitle = titleInput.value.trim();
      const newColumns = parseInt(columnsInput.value);
      const oldColumns = this.config.pages[index].columns;
      
      if (!newTitle) {
        this.showMessage('页面标题不能为空', 'error');
        return;
      }
      
      if (newColumns < 1 || newColumns > 20) {
        this.showMessage('列数必须在 1-20 之间', 'error');
        return;
      }
      
      // 如果列数减少，提示用户确认
      if (newColumns < oldColumns) {
        const isConfirmed = confirm(
          `列数从 ${oldColumns} 减少为 ${newColumns}，\n` +
          `这可能导致第 ${newColumns + 1} 列及之后的数据被删除。\n\n` +
          `确定要继续吗？`
        );
        
        if (!isConfirmed) {
          return;  // 用户取消，不保存
        }
      }
      
      // 更新本地配置
      this.config.pages[index].title = newTitle;
      this.config.pages[index].columns = newColumns;
      
      // 直接调用 API 保存到服务器
      this.savePageConfig(index);
      
      // 更新显示
      titleDisplay.textContent = newTitle;
      columnsDisplay.textContent = `${newColumns} 列`;
      titleDisplay.style.display = 'block';
      columnsDisplay.style.display = 'none';
      titleInput.style.display = 'none';
      columnsInput.style.display = 'none';
      editBtn.textContent = '✏️ 编辑';
      item.dataset.editing = 'false';
    }
  }


  // 新增方法：保存单个页面的配置
  async savePageConfig(index) {
    const result = await this.fetchAPI('/config', {
      method: 'POST',
      body: JSON.stringify(this.config)
    });

    if (result?.success) {
      this.showMessage('页面配置已保存！', 'success');
      this.renderPageTabs();  // 更新首页的页面选项卡
      
      // 如果修改的是当前页面，刷新表格显示最新的列数
      if (this.currentPageId === this.config.pages[index].id) {
        const page = this.config.pages[index];
        this.renderTable(page);  // 重新渲染表格
      }
    } else {
      this.showMessage('保存页面配置失败', 'error');
    }
  }

  async deletePage(index) {
    if (confirm('确定要删除这个页面吗？')) {
      this.config.pages.splice(index, 1);

      // 直接保存到服务器
      const result = await this.fetchAPI('/config', {
        method: 'POST',
        body: JSON.stringify(this.config)
      });

      if (result?.success) {
        this.showMessage('页面已删除！', 'success');
        this.renderPagesList();
        this.loadConfig();  // 重新加载应用，切换到第一个页面
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