/**
 * Cache Management Utility
 * Clears Node.js require cache for development
 */

/**
 * Clear require cache for specific directories
 * @param {Array<string>} directories - Array of directory paths to clear
 */
function clearRequireCache(directories = ['models', 'controllers', 'middleware', 'utils']) {
    if (process.env.NODE_ENV !== 'development') {
        return; // Only clear cache in development
    }

    let clearedCount = 0;
    
    Object.keys(require.cache).forEach((key) => {
        // Check if the cached module is in one of the specified directories
        const shouldClear = directories.some(dir => key.includes(`/${dir}/`));
        
        if (shouldClear) {
            delete require.cache[key];
            clearedCount++;
        }
    });

    if (clearedCount > 0) {
    }
}

/**
 * Watch for file changes and clear cache
 */
function setupCacheWatcher() {
    if (process.env.NODE_ENV !== 'development') {
        return;
    }

    const fs = require('fs');
    const path = require('path');

    const watchDirs = ['models', 'controllers', 'middleware', 'utils'];
    
    watchDirs.forEach(dir => {
        const dirPath = path.join(__dirname, '..', dir);
        
        if (fs.existsSync(dirPath)) {
            fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
                if (filename && filename.endsWith('.js')) {
                    clearRequireCache([dir]);
                }
            });
        }
    });

}

module.exports = {
    clearRequireCache,
    setupCacheWatcher
};
