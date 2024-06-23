# Seed Counter application

<img alt="Link to demo page" src="https://img.shields.io/badge/DEMO-darkgreen?style=flat-square&link=https%3A%2F%2Fseedcount.jreyesr.com%2F" height=50>

This repo contains the source code for [a web application that can count fruit seeds](https://seedcount.jreyesr.com/).

To use:

1. Place some seeds on a sheet of white (printer) paper. Leave some space at the page's borders (don't place seeds right up to the edges)
1. For best results, try to have the seeds separated from each other (i.e. no clumps)
1. Obtain a smartphone or tablet (i.e. some device that can run a web browser such as Chrome, and has a back-facing camera). Android preferred
1. Click the DEMO button above on the device to navigate to the app, or go to <https://seedcount.jreyesr.com/>
1. If prompted, allow the application to access the device's camera
1. You should see a feed from the device's back-facing camera
1. Move the device so the camera sees the entire page filled with seeds, and nothing else
1. Press the red button to capture an image
1. A few seconds later, you'll get an image to the right of the live feed, which contains the identified seeds

## Details

The app uses [OpenCV.js](https://docs.opencv.org/4.x/df/d0a/tutorial_js_intro.html), which allows it to perform image processing operations entirely client-side (traditionally OpenCV requires a Python or C++ backend).

The exact algorithms used are documented in great detail in [a blog post](https://blog.jreyesr.com/posts/seedcounter/).
