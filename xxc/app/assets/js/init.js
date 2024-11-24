// Initialize global and process
if(typeof global === 'undefined') {
    window.global = window;
}
const process = global.process || {type: 'renderer', env: {HOT: window.location.search.includes('hot'), port: 3000}};
if(window.location.search.includes('debug=1')) {
    window.DEBUG = true;
}

// Add stylesheet
const addStylesheet = () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = process.env.HOT
        ? `http://localhost:${process.env.PORT || 3000}/dist/style.css`
        : './dist/style.css';
    link.id = 'theme';
    document.head.appendChild(link);
};

// Add stylesheet immediately if head is available
if (document.head) {
    addStylesheet();
} else {
    // Otherwise wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', addStylesheet);
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Load bundle
    const script = document.createElement('script');
    const port = process.env.PORT || 3000;
    script.src = process.env.HOT
        ? `http://localhost:${port}/dist/bundle.js`
        : './dist/bundle.js';
    document.body.appendChild(script);
});
