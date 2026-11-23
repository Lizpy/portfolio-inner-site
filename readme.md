# Vaibhav Kumar - Portfolio

My portfolio website: a Fedora-terminal boot screen that drops you straight into a retro 3D computer running my "VaibhavOS" showcase.

## Credits

This site is built on [Henry Heffernan](https://henryheffernan.com/)'s open-source portfolio, released under the MIT License (see `LICENSE.md`). The 3D scene, OS design and most of the engineering are his work, and huge thanks to him for open-sourcing it. The original repositories are:

- 3D scene: https://github.com/henryjeff/portfolio-website
- Inner OS site: https://github.com/henryjeff/portfolio-inner-site

## Project layout

```
vk-resorces/
├── portfolio-website/      3D desk scene + Fedora terminal landing page (this repo)
│   └── static/os/          built copy of the inner OS site (loaded in the monitor iframe at /os/)
└── portfolio-inner-site/   the OS + showcase pages (About, Experience, Projects, Contact)
```

## Build and run

```bash
# 1. Build the inner OS site (served at /os/)
cd portfolio-inner-site
npm install
npm run build

# 2. Copy it into the 3D site's static folder
rm -rf ../portfolio-website/static/os
cp -r build ../portfolio-website/static/os

# 3. Build and serve the 3D site
cd ../portfolio-website
npm install
npm run build
npm start            # http://localhost:8080
```

To edit the content, change the files in `portfolio-inner-site/src/components/showcase/` and repeat steps 1-3.
