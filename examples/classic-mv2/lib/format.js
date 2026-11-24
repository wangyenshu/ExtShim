// Plain old global helpers (MV2 background pages are regular pages: these become window properties).
function formatMinutes(min) {
  if (min < 1) return 'less than a minute';
  return Math.round(min) + (Math.round(min) === 1 ? ' minute' : ' minutes');
}
var WORDS_PER_MINUTE = 230;
