// js/core/router.js — Simple route registry for menu SPA
const routes = {};

export function registerRoute(path, renderFn) {
    routes[path] = renderFn;
}

export function navigate(path) {
    if (routes[path]) {
        const appRoot = document.getElementById('app-root');
        appRoot.innerHTML = '';

        const view = routes[path]();
        if (view instanceof Node) {
            appRoot.appendChild(view);
        } else if (typeof view === 'string') {
            appRoot.innerHTML = view;
        }
    } else {
        console.error('Route not found:', path);
        if (routes['/menu']) navigate('/menu');
    }
}
