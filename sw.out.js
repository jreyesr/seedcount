importScripts('./workbox/workbox-v7.1.0/workbox-sw.js');

workbox.setConfig({
    modulePathPrefix: './workbox/workbox-v7.1.0/',
});

workbox.routing.registerRoute(
    ({request}) => {
        return request.destination === 'document' || request.url === "https://docs.opencv.org/4.x/opencv.js"
    },
    new workbox.strategies.NetworkFirst()
);

// NOTE: Don't touch the line below! It'll be replaced by workbox-cli to include data generated
// from workbox-config.js
workbox.precaching.precacheAndRoute([{"revision":"bb989b4ddd927fb65305ca65b0ce246a","url":"index.html"}])

workbox.routing.registerRoute(
    new workbox.routing.NavigationRoute(
        workbox.precaching.createHandlerBoundToURL("./index.html")
    ),
    new workbox.strategies.NetworkFirst()
)

// The Background Sync plugin is used to queue the bug reports
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('bugReports', {
  maxRetentionTime: 3 * 24 * 60, // we'll keep requests for up to 3 days
});
workbox.routing.registerRoute(
  /\/bugreport/,
  new workbox.strategies.NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);