importScripts('./workbox/workbox-v7.1.0/workbox-sw.js');

workbox.setConfig({
    modulePathPrefix: './workbox/workbox-v7.1.0/',
});

const EXTERNAL_LIBS = [
    "https://docs.opencv.org/4.x/opencv.js",
    "https://unpkg.com/comlink@4.4.1/dist/umd/comlink.js",
]
workbox.routing.registerRoute(
    ({request}) => {
        return request.destination === 'document' || EXTERNAL_LIBS.includes(request.url)
    },
    new workbox.strategies.NetworkFirst()
);

// NOTE: Don't touch the line below! It'll be replaced by workbox-cli to include data generated
// from workbox-config.js
workbox.precaching.precacheAndRoute([{"revision":"d3085ddc75d8d7f608fee836a8b6a7fa","url":"index.html"},{"revision":"d3b6fb4253404e33a92de39777d344de","url":"ww.js"}])

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
