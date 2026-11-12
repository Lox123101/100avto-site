/* Куда улетает каждая деталь при полном разборе (метры, оси модели: X — вперёд, Y — вверх, Z — вбок) */
window.EXPLODE = function (key) {
  var a = key.split('|'), p = a[0], s = a[1] || '', z = s.indexOf('L') >= 0 ? 1 : s.indexOf('R') >= 0 ? -1 : 0, f = s[0] === 'F' ? 1 : -1;
  switch (p) {
    case 'hood': return [0.35, 0.95, 0];
    case 'engine': return [0.2, 0.45, 0];
    case 'windshield': return [0.3, 0.8, 0];
    case 'rearglass': return [-0.45, 0.65, 0];
    case 'fdoor': return [0.05, 0, 0.9 * z];
    case 'rdoor': return [-0.1, 0, 0.9 * z];
    case 'tyre': return [0.2 * f, 0, 1.75 * z];
    case 'rim': return [0.12 * f, 0, 1.15 * z];
    case 'brake': return [0.05 * f, 0, 0.6 * z];
    case 'headlight': return [0.55, 0.05, 0.4 * z];
    case 'taillight': return [-0.6, 0.1, 0.2 * z];
    case 'grille': return [0.85, 0.02, 0];
  }
  return [0, 0, 0];
};
