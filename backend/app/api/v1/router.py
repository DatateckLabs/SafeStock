from fastapi import APIRouter
from app.api.v1.endpoints import (
    me, usuarios, insumos, ferramentas,
    ordens_compra, parametros_globais,
    estoques_minimos, criticidades_ferramentas, dashboard,
    config_fornecedores, config_ferramentas_cfg, disparos,
)

router = APIRouter(prefix="/api/v1")

router.include_router(me.router)
router.include_router(usuarios.router)
router.include_router(insumos.router)
router.include_router(ferramentas.router)
router.include_router(ordens_compra.router)
router.include_router(parametros_globais.router)
router.include_router(estoques_minimos.router)
router.include_router(criticidades_ferramentas.router)
router.include_router(dashboard.router)
router.include_router(config_fornecedores.router)
router.include_router(config_ferramentas_cfg.router)
router.include_router(disparos.router)
