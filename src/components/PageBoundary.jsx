import { Component } from 'react';

export default class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="page-error" role="alert"><h2>Раздел не загрузился</h2><p>Проверь соединение и обнови страницу. Сохранённые варианты останутся в браузере.</p><button onClick={() => window.location.reload()}>Обновить страницу</button></section>;
    return this.props.children;
  }
}
