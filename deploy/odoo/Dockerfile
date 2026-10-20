# Odoo 19 Community + training_management addon, for Render (free tier).
# Build context = repository root (see render.yaml).
FROM odoo:19.0

USER root
COPY custom_addons /mnt/extra-addons
COPY deploy/odoo/entrypoint.sh /deploy-entrypoint.sh
RUN chmod +x /deploy-entrypoint.sh && chown -R odoo:odoo /mnt/extra-addons

USER odoo
ENTRYPOINT ["/deploy-entrypoint.sh"]
