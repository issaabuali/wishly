module.exports = { join: (...a) => a.join('/'), normalize: (p) => p, extname: (p) => (p.match(/\.[^./]+$/) || [''])[0] };
