// fetchDebug.js
// (function() {
//   const orig = window.fetch;
//   window.fetch = async function(url, opts) {
//     console.groupCollapsed('[🚨 fetch]', url);
//     console.log('→ options:', opts);
//     const res = await orig(url, opts);
//     console.log('← status:', res.status);
//     console.groupEnd();
//     return res;
//   };
// })();
