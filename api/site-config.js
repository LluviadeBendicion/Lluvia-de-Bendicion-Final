const configs = new Map([
  ['affiliate-status', require('./affiliate-status.json')],
  ['content-config', require('./content-config.json')],
  ['donations-config', require('./donations-config.json')],
  ['forms-config', require('./forms-config.json')],
  ['media-config', require('./media-config.json')],
  ['radio-config', require('./radio-config.json')],
  ['social-config', require('./social-config.json')]
]);

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const config = configs.get(req.query.name);
  if (!config) return res.status(404).json({ error: 'Configuration not found' });
  return res.status(200).json(config);
};
