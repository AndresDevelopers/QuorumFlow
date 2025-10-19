if(!self.define){let e,s={};const a=(a,n)=>(a=new URL(a+".js",n).href,s[a]||new Promise(s=>{if("document"in self){const e=document.createElement("script");e.src=a,e.onload=s,document.head.appendChild(e)}else e=a,importScripts(a),s()}).then(()=>{let e=s[a];if(!e)throw new Error(`Module ${a} didn’t register its module`);return e}));self.define=(n,c)=>{const i=e||("document"in self?document.currentScript.src:"")||location.href;if(s[i])return;let t={};const r=e=>a(e,i),d={module:{uri:i},exports:t,require:r};s[i]=Promise.all(n.map(e=>d[e]||r(e))).then(e=>(c(...e),t))}}define(["./workbox-f1770938"],function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/static/WvGDrg3NLvy-QFIVM_-9M/_buildManifest.js",revision:"071f0120eafb85e8aaf358408b43e1ba"},{url:"/_next/static/WvGDrg3NLvy-QFIVM_-9M/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/_next/static/chunks/1646.a93085a0445ba909.js",revision:"a93085a0445ba909"},{url:"/_next/static/chunks/1876-5236f269dd1bf015.js",revision:"5236f269dd1bf015"},{url:"/_next/static/chunks/2015-ac3d28dd37a10a3f.js",revision:"ac3d28dd37a10a3f"},{url:"/_next/static/chunks/2056-a0b9ef4ec2ea6897.js",revision:"a0b9ef4ec2ea6897"},{url:"/_next/static/chunks/2071-9b47315219c9a17f.js",revision:"9b47315219c9a17f"},{url:"/_next/static/chunks/2117-f37e64a0bfc015a4.js",revision:"f37e64a0bfc015a4"},{url:"/_next/static/chunks/2214.01a91bb3eabadc67.js",revision:"01a91bb3eabadc67"},{url:"/_next/static/chunks/2332-b69ebd67f958487a.js",revision:"b69ebd67f958487a"},{url:"/_next/static/chunks/2364-34b7ca8acd879397.js",revision:"34b7ca8acd879397"},{url:"/_next/static/chunks/2494-2780c7576966a1f6.js",revision:"2780c7576966a1f6"},{url:"/_next/static/chunks/2619-04bc32f026a0d946.js",revision:"04bc32f026a0d946"},{url:"/_next/static/chunks/3027-0712a8710204d935.js",revision:"0712a8710204d935"},{url:"/_next/static/chunks/3675-24c2bf48d40e2661.js",revision:"24c2bf48d40e2661"},{url:"/_next/static/chunks/421-0a7c7032ae541dd4.js",revision:"0a7c7032ae541dd4"},{url:"/_next/static/chunks/4213-e376462488bfe7e4.js",revision:"e376462488bfe7e4"},{url:"/_next/static/chunks/4227-5c52b241bcdca8ce.js",revision:"5c52b241bcdca8ce"},{url:"/_next/static/chunks/4415-bf8753fcfe8fb64b.js",revision:"bf8753fcfe8fb64b"},{url:"/_next/static/chunks/4696-ecbaa22156effc8c.js",revision:"ecbaa22156effc8c"},{url:"/_next/static/chunks/4948-3e7d4b40d50fe104.js",revision:"3e7d4b40d50fe104"},{url:"/_next/static/chunks/4bd1b696-182b6b13bdad92e3.js",revision:"182b6b13bdad92e3"},{url:"/_next/static/chunks/5011-dd2d9ddd4fd9e63c.js",revision:"dd2d9ddd4fd9e63c"},{url:"/_next/static/chunks/5139.e4ff9cc3669129ed.js",revision:"e4ff9cc3669129ed"},{url:"/_next/static/chunks/5196-1e153f1ee657b29e.js",revision:"1e153f1ee657b29e"},{url:"/_next/static/chunks/5239-fd1f2ddd6bc959f1.js",revision:"fd1f2ddd6bc959f1"},{url:"/_next/static/chunks/5282-1679413c2e3eb4ec.js",revision:"1679413c2e3eb4ec"},{url:"/_next/static/chunks/5507-9a41a4ade96d261f.js",revision:"9a41a4ade96d261f"},{url:"/_next/static/chunks/5593-f294dc81893f90d4.js",revision:"f294dc81893f90d4"},{url:"/_next/static/chunks/5646-5cc8d12de6da8d08.js",revision:"5cc8d12de6da8d08"},{url:"/_next/static/chunks/6093-da8af415b686f250.js",revision:"da8af415b686f250"},{url:"/_next/static/chunks/6201-0cf1d98a91365e0a.js",revision:"0cf1d98a91365e0a"},{url:"/_next/static/chunks/6204-4bdb2185fbde4164.js",revision:"4bdb2185fbde4164"},{url:"/_next/static/chunks/6350-d274719944fd8ad0.js",revision:"d274719944fd8ad0"},{url:"/_next/static/chunks/6460-7354e67a5ccc6b79.js",revision:"7354e67a5ccc6b79"},{url:"/_next/static/chunks/6491-fa614247e1fb0404.js",revision:"fa614247e1fb0404"},{url:"/_next/static/chunks/6663-b722d9aea518dbbd.js",revision:"b722d9aea518dbbd"},{url:"/_next/static/chunks/682-fbc3fec642f267e5.js",revision:"fbc3fec642f267e5"},{url:"/_next/static/chunks/6983-902d2e40fe20eb7c.js",revision:"902d2e40fe20eb7c"},{url:"/_next/static/chunks/7035-e231585f221c5a00.js",revision:"e231585f221c5a00"},{url:"/_next/static/chunks/7124.8241b5337fc58ea2.js",revision:"8241b5337fc58ea2"},{url:"/_next/static/chunks/7171-109a08d92abf8a3d.js",revision:"109a08d92abf8a3d"},{url:"/_next/static/chunks/7197-bc5cbd9f6828d1e0.js",revision:"bc5cbd9f6828d1e0"},{url:"/_next/static/chunks/7442-8faa1e4d6a840d09.js",revision:"8faa1e4d6a840d09"},{url:"/_next/static/chunks/7620-716d8d92a7e8c6d8.js",revision:"716d8d92a7e8c6d8"},{url:"/_next/static/chunks/7735-9a86cac1d3ba19fb.js",revision:"9a86cac1d3ba19fb"},{url:"/_next/static/chunks/7776-67857daea7db78f7.js",revision:"67857daea7db78f7"},{url:"/_next/static/chunks/7961-c5decfe8febff2ae.js",revision:"c5decfe8febff2ae"},{url:"/_next/static/chunks/7c86ec74-0607f7a581006be3.js",revision:"0607f7a581006be3"},{url:"/_next/static/chunks/8475-9914b31a4a2aeb5c.js",revision:"9914b31a4a2aeb5c"},{url:"/_next/static/chunks/8693-6d076e261977f5af.js",revision:"6d076e261977f5af"},{url:"/_next/static/chunks/8839-4688865a24a3c4a3.js",revision:"4688865a24a3c4a3"},{url:"/_next/static/chunks/8960-25fb0f4d56272e90.js",revision:"25fb0f4d56272e90"},{url:"/_next/static/chunks/9213-f86934c0892b2ba1.js",revision:"f86934c0892b2ba1"},{url:"/_next/static/chunks/9396-db64a681443a00d2.js",revision:"db64a681443a00d2"},{url:"/_next/static/chunks/954-0d44800222e2af8a.js",revision:"0d44800222e2af8a"},{url:"/_next/static/chunks/9639-61bd8ed0370e5de5.js",revision:"61bd8ed0370e5de5"},{url:"/_next/static/chunks/971-e780dc4c7b8af8bb.js",revision:"e780dc4c7b8af8bb"},{url:"/_next/static/chunks/9760-047b6d335773de83.js",revision:"047b6d335773de83"},{url:"/_next/static/chunks/9915-41fd8d6f0b53aeea.js",revision:"41fd8d6f0b53aeea"},{url:"/_next/static/chunks/9972-6552c6c71285a15a.js",revision:"6552c6c71285a15a"},{url:"/_next/static/chunks/app/(auth)/forgot-password/page-e8a307f64e0189e0.js",revision:"e8a307f64e0189e0"},{url:"/_next/static/chunks/app/(auth)/layout-9ab18347b43d30c0.js",revision:"9ab18347b43d30c0"},{url:"/_next/static/chunks/app/(auth)/login/page-6798d5a81a1c1158.js",revision:"6798d5a81a1c1158"},{url:"/_next/static/chunks/app/(auth)/register/page-02f0a394e592128f.js",revision:"02f0a394e592128f"},{url:"/_next/static/chunks/app/(main)/birthdays/%5Bid%5D/edit/page-ba12d1c110f8c487.js",revision:"ba12d1c110f8c487"},{url:"/_next/static/chunks/app/(main)/birthdays/page-5ced36ced8b9aea4.js",revision:"5ced36ced8b9aea4"},{url:"/_next/static/chunks/app/(main)/consejo/page-3c3b8b8626f83a5a.js",revision:"3c3b8b8626f83a5a"},{url:"/_next/static/chunks/app/(main)/converts/%5Bid%5D/edit/page-2b2ae4aa9d4faa1f.js",revision:"2b2ae4aa9d4faa1f"},{url:"/_next/static/chunks/app/(main)/converts/add/page-f910856d37f1225c.js",revision:"f910856d37f1225c"},{url:"/_next/static/chunks/app/(main)/converts/page-5232355e696b03e1.js",revision:"5232355e696b03e1"},{url:"/_next/static/chunks/app/(main)/council/page-84ca7eb5943739c6.js",revision:"84ca7eb5943739c6"},{url:"/_next/static/chunks/app/(main)/family-search/page-8e8c60fd75edccf0.js",revision:"8e8c60fd75edccf0"},{url:"/_next/static/chunks/app/(main)/future-members/%5Bid%5D/edit/page-16bd119cb61fea7d.js",revision:"16bd119cb61fea7d"},{url:"/_next/static/chunks/app/(main)/future-members/add/page-6fe7a48227dd7a91.js",revision:"6fe7a48227dd7a91"},{url:"/_next/static/chunks/app/(main)/future-members/page-41904f9792a29f84.js",revision:"41904f9792a29f84"},{url:"/_next/static/chunks/app/(main)/layout-795e1a2f92a69bc1.js",revision:"795e1a2f92a69bc1"},{url:"/_next/static/chunks/app/(main)/members/%5Bid%5D/page-ceb48ef4dcd11151.js",revision:"ceb48ef4dcd11151"},{url:"/_next/static/chunks/app/(main)/members/page-9752c928d58de828.js",revision:"9752c928d58de828"},{url:"/_next/static/chunks/app/(main)/ministering/%5Bid%5D/page-88a9986ed2f054ea.js",revision:"88a9986ed2f054ea"},{url:"/_next/static/chunks/app/(main)/ministering/add/page-86bb11078e987f14.js",revision:"86bb11078e987f14"},{url:"/_next/static/chunks/app/(main)/ministering/page-f0cef40af616abcb.js",revision:"f0cef40af616abcb"},{url:"/_next/static/chunks/app/(main)/ministering/urgent/page-9e7e84abc379293d.js",revision:"9e7e84abc379293d"},{url:"/_next/static/chunks/app/(main)/missionary-work/page-c422c94247129b2d.js",revision:"c422c94247129b2d"},{url:"/_next/static/chunks/app/(main)/observations/page-8d4b3ad618d8ac51.js",revision:"8d4b3ad618d8ac51"},{url:"/_next/static/chunks/app/(main)/page-488e9e5ec761da4b.js",revision:"488e9e5ec761da4b"},{url:"/_next/static/chunks/app/(main)/profile/page-ee37efde6ed24f81.js",revision:"ee37efde6ed24f81"},{url:"/_next/static/chunks/app/(main)/reports/%5Bid%5D/edit/page-67d910c051ef138f.js",revision:"67d910c051ef138f"},{url:"/_next/static/chunks/app/(main)/reports/add-baptism/page-7db512e47ca93a17.js",revision:"7db512e47ca93a17"},{url:"/_next/static/chunks/app/(main)/reports/add/page-f63e6e41cf5f47a4.js",revision:"f63e6e41cf5f47a4"},{url:"/_next/static/chunks/app/(main)/reports/edit-baptism/page-38b4d90948220943.js",revision:"38b4d90948220943"},{url:"/_next/static/chunks/app/(main)/reports/page-92ae99f60f05df59.js",revision:"92ae99f60f05df59"},{url:"/_next/static/chunks/app/(main)/service/%5Bid%5D/edit/page-0c8019544d851299.js",revision:"0c8019544d851299"},{url:"/_next/static/chunks/app/(main)/service/add/page-f23dd9bc532a6af2.js",revision:"f23dd9bc532a6af2"},{url:"/_next/static/chunks/app/(main)/service/page-4e7cf5d96602c5af.js",revision:"4e7cf5d96602c5af"},{url:"/_next/static/chunks/app/(main)/settings/page-7dffeb959d85cfdd.js",revision:"7dffeb959d85cfdd"},{url:"/_next/static/chunks/app/_not-found/page-07632f1b61ab632d.js",revision:"07632f1b61ab632d"},{url:"/_next/static/chunks/app/api/members/%5Bid%5D/route-501189ba926873b4.js",revision:"501189ba926873b4"},{url:"/_next/static/chunks/app/api/members/route-501189ba926873b4.js",revision:"501189ba926873b4"},{url:"/_next/static/chunks/app/api/suggestions/route-501189ba926873b4.js",revision:"501189ba926873b4"},{url:"/_next/static/chunks/app/error-a3ccf2dd6db8569f.js",revision:"a3ccf2dd6db8569f"},{url:"/_next/static/chunks/app/global-error-f7e73250a3a085c3.js",revision:"f7e73250a3a085c3"},{url:"/_next/static/chunks/app/layout-00193b98e0b02a81.js",revision:"00193b98e0b02a81"},{url:"/_next/static/chunks/bc9e92e6-b9ec968ff5433933.js",revision:"b9ec968ff5433933"},{url:"/_next/static/chunks/framework-b9fd9bcc3ecde907.js",revision:"b9fd9bcc3ecde907"},{url:"/_next/static/chunks/main-app-6212ed79f8d3e0f1.js",revision:"6212ed79f8d3e0f1"},{url:"/_next/static/chunks/main-ea2368b07a40acd4.js",revision:"ea2368b07a40acd4"},{url:"/_next/static/chunks/pages/_app-e8b861c87f6f033c.js",revision:"e8b861c87f6f033c"},{url:"/_next/static/chunks/pages/_error-c8f84f7bd11d43d4.js",revision:"c8f84f7bd11d43d4"},{url:"/_next/static/chunks/polyfills-42372ed130431b0a.js",revision:"846118c33b2c0e922d7b3a7676f81f6f"},{url:"/_next/static/chunks/webpack-f55d2414df19543f.js",revision:"f55d2414df19543f"},{url:"/_next/static/css/dc283e6cbee96e17.css",revision:"dc283e6cbee96e17"},{url:"/logo.svg",revision:"63a37a73bb20278c1ac8effac3e6d759"},{url:"/manifest.json",revision:"64d11f57a208c153b41f90004c004671"},{url:"/version.json",revision:"f9ee1cb37d71e486a0999177b7dd3d77"}],{ignoreURLParametersMatching:[/^utm_/,/^fbclid$/]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:function(e){var s=e.response;return _async_to_generator(function(){return _ts_generator(this,function(e){return[2,s&&"opaqueredirect"===s.type?new Response(s.body,{status:200,statusText:"OK",headers:s.headers}):s]})})()}}]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,new e.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:31536e3})]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,new e.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,new e.StaleWhileRevalidate({cacheName:"static-font-assets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,new e.StaleWhileRevalidate({cacheName:"static-image-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:2592e3})]}),"GET"),e.registerRoute(/\/_next\/static.+\.js$/i,new e.CacheFirst({cacheName:"next-static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+$/i,new e.StaleWhileRevalidate({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp3|wav|ogg)$/i,new e.CacheFirst({cacheName:"static-audio-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp4|webm)$/i,new e.CacheFirst({cacheName:"static-video-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:js)$/i,new e.StaleWhileRevalidate({cacheName:"static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:48,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:css|less)$/i,new e.StaleWhileRevalidate({cacheName:"static-style-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/data\/.+\/.+\.json$/i,new e.StaleWhileRevalidate({cacheName:"next-data",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:json|xml|csv)$/i,new e.NetworkFirst({cacheName:"static-data-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(function(e){var s=e.sameOrigin,a=e.url.pathname;return!(!s||a.startsWith("/api/auth/callback")||!a.startsWith("/api/"))},new e.NetworkFirst({cacheName:"apis",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:16,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(function(e){var s=e.request,a=e.url.pathname,n=e.sameOrigin;return"1"===s.headers.get("RSC")&&"1"===s.headers.get("Next-Router-Prefetch")&&n&&!a.startsWith("/api/")},new e.NetworkFirst({cacheName:"pages-rsc-prefetch",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(function(e){var s=e.request,a=e.url.pathname,n=e.sameOrigin;return"1"===s.headers.get("RSC")&&n&&!a.startsWith("/api/")},new e.NetworkFirst({cacheName:"pages-rsc",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(function(e){var s=e.url.pathname;return e.sameOrigin&&!s.startsWith("/api/")},new e.NetworkFirst({cacheName:"pages",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(function(e){return!e.sameOrigin},new e.NetworkFirst({cacheName:"cross-origin",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:3600})]}),"GET")});

// --- QuorumFlow custom notification handlers ---------------------------------
// The default Workbox bundle does not emit push notifications by itself. These
// listeners ensure that payloads sent from Firebase Cloud Messaging are
// rendered on every device, including mobile PWAs. Keep this block readable so
// future contributors (human or AI) can quickly grasp the intent.
self.addEventListener('push', (event) => {
  const defaultTitle = 'QuorumFlow';

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      // Some backends send plain text payloads; fall back gracefully.
      payload = { body: event.data.text() };
    }
  }

  const {
    title = defaultTitle,
    body = 'Tienes una nueva notificación.',
    icon,
    badge,
    url,
    vibrate,
    tag = 'quorumflow-notification',
    requireInteraction = false,
    renotify = false,
    actions,
  } = payload || {};

  const actionTargets = Array.isArray(actions)
    ? actions
        .filter((action) => action && action.action && action.url)
        .reduce((acc, action) => {
          acc[action.action] = action.url;
          return acc;
        }, {})
    : undefined;

  const notificationOptions = {
    body,
    icon: icon || '/logo.svg',
    badge: badge || '/logo.svg',
    vibrate: vibrate || [100, 50, 100],
    tag,
    renotify,
    requireInteraction,
    data: {
      url,
      actionTargets,
      // Preserve original payload for analytics / debugging if needed later.
      rawPayload: payload,
    },
  };

  if (Array.isArray(actions)) {
    notificationOptions.actions = actions
      .filter((action) => action && action.action && action.title)
      .slice(0, 3)
      .map((action) => ({
        action: action.action,
        title: action.title,
        icon: action.icon,
      }));
  }

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const actionTargets = notification.data && notification.data.actionTargets;
  const destination =
    (event.action && actionTargets && actionTargets[event.action]) ||
    (notification.data && notification.data.url) ||
    '/';

  notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of allClients) {
        if ('focus' in client) {
          if (destination && 'navigate' in client) {
            try {
              await client.navigate(destination);
            } catch (error) {
              // Some browsers may not allow navigate on already focused clients; ignore.
              console.warn('[SW] navigation failed', error);
            }
          }
          return client.focus();
        }
      }

      if (destination) {
        return clients.openWindow(destination);
      }
    })()
  );
});

self.addEventListener('notificationclose', () => {
  // The close event gives us a hook for future telemetry. For now we simply
  // keep the listener so platforms such as iOS properly finalize the
  // interaction lifecycle without warnings.
});
