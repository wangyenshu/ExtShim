// Full runtime: the core plus every optional API module.
// CLI bundles use core.js plus only the modules an extension's permissions need.
import runtime from './core.js';
import './api/all.js';

export default runtime;
