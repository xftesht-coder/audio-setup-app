export default function RoomServiceLink({ children = 'Кабели в 3D ↗' }) {
  function open(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set('room', 'patch');
    url.hash = 'room';
    window.history.pushState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  return <a href="?room=patch#room" onClick={open}>{children}</a>;
}
