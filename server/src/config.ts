import path from 'node:path'

/*
 * Configuração do servidor (variáveis de ambiente, com padrões para desenvolvimento).
 *  - PORT: porta HTTP (padrão 3001; o Vite encaminha /api para cá no dev);
 *  - DB_FILE: arquivo do SQLite (padrão server/data/ierp.sqlite). ":memory:" = banco em memória.
 *  - ARQUIVOS_DIR: onde ficam os arquivos enviados (padrão server/data/arquivos);
 *  - GEO_CONTATO: contato que vai no User-Agent das consultas ao Nominatim (exigência da
 *    política de uso do serviço);
 *  - SITE_DIR: pasta com as telas já compiladas (`npm run build` → `dist/` da raiz). Com ela, o
 *    MESMO servidor entrega as telas e a API numa porta só (produção; ver IMPLANTACAO.md). Sem
 *    ela (desenvolvimento), as telas vêm do Vite.
 */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  dbFile: process.env.DB_FILE ?? path.resolve(import.meta.dirname, '..', 'data', 'ierp.sqlite'),
  arquivosDir:
    process.env.ARQUIVOS_DIR ?? path.resolve(import.meta.dirname, '..', 'data', 'arquivos'),
  geoContato: process.env.GEO_CONTATO ?? 'rtbrti03@re-teckbr.com',
  siteDir: process.env.SITE_DIR || null,
}
