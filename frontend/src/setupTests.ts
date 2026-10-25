import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrolling; the app shell scrolls to top on navigation.
window.scrollTo = () => undefined;
