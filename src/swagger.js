const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

function loadYaml(fileName) {
  const p = path.join(__dirname, '..', 'docs', fileName);
  if (!fs.existsSync(p)) return null;
  const content = fs.readFileSync(p, 'utf8');
  return yaml.load(content);
}

function setupSwagger(app) {
  const specs = {
    prescriptions: loadYaml('openapi-prescriptions.yml'),
    medicalOrders: loadYaml('openapi-medical-orders.yml'),
    orderTemplates: loadYaml('openapi-order-templates.yml'),
    clinicalWorkflow: loadYaml('openapi-clinical-workflow.yml')
  };

  // unified spec (if present) - prefer this as the main /docs UI
  const unified = loadYaml('openapi-unified.yml');

  // Mount a swagger UI for each spec (if present)
  if (specs.prescriptions) {
    app.use('/docs/prescriptions', swaggerUi.serve, swaggerUi.setup(specs.prescriptions));
    app.get('/docs/prescriptions.json', (_req, res) => res.json(specs.prescriptions));
  }

  if (specs.medicalOrders) {
    app.use('/docs/medical-orders', swaggerUi.serve, swaggerUi.setup(specs.medicalOrders));
    app.get('/docs/medical-orders.json', (_req, res) => res.json(specs.medicalOrders));
  }

  if (specs.orderTemplates) {
    app.use('/docs/order-templates', swaggerUi.serve, swaggerUi.setup(specs.orderTemplates));
    app.get('/docs/order-templates.json', (_req, res) => res.json(specs.orderTemplates));
  }

  if (specs.clinicalWorkflow) {
    app.use('/docs/clinical-workflow', swaggerUi.serve, swaggerUi.setup(specs.clinicalWorkflow));
    app.get('/docs/clinical-workflow.json', (_req, res) => res.json(specs.clinicalWorkflow));
  }

  // If a unified spec exists, serve it at /docs (Swagger UI)
  if (unified) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(unified));
    app.get('/docs/openapi.json', (_req, res) => res.json(unified));
  } else {
    // Fallback index for discoverability when unified spec is not present
    app.get('/docs', (req, res) => {
      res.json({
        docs: {
          prescriptions: `${req.protocol}://${req.get('host')}/docs/prescriptions`,
          medicalOrders: `${req.protocol}://${req.get('host')}/docs/medical-orders`,
          orderTemplates: `${req.protocol}://${req.get('host')}/docs/order-templates`,
          clinicalWorkflow: `${req.protocol}://${req.get('host')}/docs/clinical-workflow`
        }
      });
    });
  }
}

module.exports = { setupSwagger };
