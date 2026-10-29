import { lazy } from 'react';

// Guest snapshots never import the editor or initialise its persistent stores.
const Entry = lazy(() => new URLSearchParams(window.location.search).get('view') === 'share'
  ? import('./components/ShareView.jsx') : import('./App.jsx'));

export default Entry;
