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

workbox.precaching.precacheAndRoute([{"revision":"80e1c3fac174da0ff3c36f62ba8131ee","url":"index.html"}])

workbox.routing.registerRoute(
    new workbox.routing.NavigationRoute(
        workbox.precaching.createHandlerBoundToURL("./index.html")
    )
)