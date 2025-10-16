// Менеджер тем UI
const THEME_STORAGE_KEY = 'ui-theme.v1';
const THEMES = {
  CLASSIC: 'classic',
  TILE: 'tile'
};

class ThemeManager {
  constructor() {
    this.currentTheme = this.loadTheme();
  }

  loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved && Object.values(THEMES).includes(saved) ? saved : THEMES.TILE;
    } catch {
      return THEMES.TILE;
    }
  }

  saveTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.error('Ошибка сохранения темы:', e);
    }
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      console.error('Неизвестная тема:', theme);
      return;
    }
    
    this.currentTheme = theme;
    this.saveTheme(theme);
    this.applyTheme();
  }

  toggleTheme() {
    const newTheme = this.currentTheme === THEMES.CLASSIC ? THEMES.TILE : THEMES.CLASSIC;
    this.setTheme(newTheme);
  }

  applyTheme() {
    document.body.setAttribute('data-theme', this.currentTheme);
    
    // Скрыть/показать элементы в зависимости от темы
    const classicElements = document.querySelectorAll('.theme-classic-only');
    const tileElements = document.querySelectorAll('.theme-tile-only');
    
    if (this.currentTheme === THEMES.CLASSIC) {
      classicElements.forEach(el => el.style.display = '');
      tileElements.forEach(el => el.style.display = 'none');
      
      // Инициализация классической темы
      if (typeof initClassicTheme === 'function') {
        initClassicTheme();
      }
    } else {
      classicElements.forEach(el => el.style.display = 'none');
      tileElements.forEach(el => el.style.display = '');
      
      // Инициализация плиточной темы
      if (typeof initTileTheme === 'function') {
        initTileTheme();
      }
    }
    
    // Обновить иконку кнопки после применения темы
    this.updateToggleButton();
  }

  init() {
    this.applyTheme();
    
    // Добавить обработчик на кнопку переключения
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => this.toggleTheme());
      
      // Обновить текст кнопки
      this.updateToggleButton();
    }
  }

  updateToggleButton() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      const icon = this.currentTheme === THEMES.CLASSIC ? '🎨' : '📋';
      const title = this.currentTheme === THEMES.CLASSIC ? 'Плиточный вид' : 'Классический вид';
      themeToggleBtn.innerHTML = icon;
      themeToggleBtn.title = title;
    }
  }
}

// Глобальный экземпляр менеджера тем
const themeManager = new ThemeManager();

