import { randomUUID } from 'node:crypto'
import type { Kysely } from 'kysely'
import { normalizar } from '../../shared/texto.js'

/*
 * Sistema › Cadastros (pedido do usuário, 19/10/2026):
 *  - materiais — nome nos 3 idiomas (LocalizedText em JSON) + `nome_ordem` (português, para
 *    ordenar/buscar). Já nasce com a lista inicial de 96 materiais passada por ele (inglês e
 *    chinês marcados como tradução automática, revisáveis na tela);
 *  - areas_estoque — nome (como foi escrito) e descrição opcional (LocalizedText);
 *  - recipientes — caixotes (CXT-AAAA0001) e pallets (PLT-AAAA0001): material, tara (kg), área e
 *    posição; numeração por tipo e ano.
 * Todos: ativo/inativo (não se exclui) e histórico na tabela `historico`.
 */

/** Lista inicial: [português, inglês, chinês tradicional]. */
const MATERIAIS: [string, string, string][] = [
  ['Adaptadores AC (com cabo)', 'AC adapters (with cable)', '交流電源轉接器（含線）'],
  ['Adaptadores AC (sem cabo)', 'AC adapters (without cable)', '交流電源轉接器（不含線）'],
  ['Alumínio', 'Aluminum', '鋁'],
  ['Alumínio banhado', 'Plated aluminum', '電鍍鋁'],
  ['Alumínio bloco', 'Aluminum block', '鋁塊'],
  ['Antena', 'Antenna', '天線'],
  ['Antena - Alumínio', 'Antenna - Aluminum', '天線 - 鋁'],
  ['Aço', 'Steel', '鋼'],
  ['Aço / Ferro (misto)', 'Steel / Iron (mixed)', '鋼／鐵（混合）'],
  ['Baterias - Alcalinas', 'Batteries - Alkaline', '電池 - 鹼性'],
  ['Baterias - Chumbo', 'Batteries - Lead', '電池 - 鉛'],
  ['Baterias - Chumbo-ácido', 'Batteries - Lead-acid', '電池 - 鉛酸'],
  ['Baterias - Chumbo-ácido danificadas', 'Batteries - Damaged lead-acid', '電池 - 受損鉛酸'],
  ['Baterias - Cádmio', 'Batteries - Cadmium', '電池 - 鎘'],
  ['Baterias - Lítio primária', 'Batteries - Primary lithium', '電池 - 一次鋰'],
  [
    'Baterias - Lítio primária danificadas',
    'Batteries - Damaged primary lithium',
    '電池 - 受損一次鋰',
  ],
  ['Baterias - Mistas', 'Batteries - Mixed', '電池 - 混合'],
  ['Baterias - Níquel-cádmio', 'Batteries - Nickel-cadmium', '電池 - 鎳鎘'],
  ['Baterias - Níquel-hidreto metálico', 'Batteries - Nickel-metal hydride', '電池 - 鎳氫'],
  ['Baterias - Polímero de íon de lítio', 'Batteries - Lithium-ion polymer', '電池 - 鋰離子聚合物'],
  ['Baterias - Íon de lítio', 'Batteries - Lithium-ion', '電池 - 鋰離子'],
  ['Baterias - Íon de lítio danificadas', 'Batteries - Damaged lithium-ion', '電池 - 受損鋰離子'],
  ['Baterias - Íon de lítio de notebook', 'Batteries - Laptop lithium-ion', '電池 - 筆電鋰離子'],
  ['Borracha', 'Rubber', '橡膠'],
  ['CRT - Monitor', 'CRT - Monitor', 'CRT - 顯示器'],
  ['Cabo de fibra óptica', 'Fiber optic cable', '光纖電纜'],
  ['Cabos - Mistos', 'Cables - Mixed', '電纜 - 混合'],
  ['Capacitores', 'Capacitors', '電容器'],
  ['Cartucho de toner', 'Toner cartridge', '碳粉匣'],
  ['Cartuchos de tinta (não perigosos)', 'Ink cartridges (non-hazardous)', '墨水匣（非危險品）'],
  ['Cartuchos de tinta (perigosos)', 'Ink cartridges (hazardous)', '墨水匣（危險品）'],
  ['Celular sem bateria', 'Cell phone without battery', '手機（無電池）'],
  ['Cobre', 'Copper', '銅'],
  ['Conectores', 'Connectors', '連接器'],
  ['Dispositivos com bateria de lítio', 'Devices with lithium battery', '含鋰電池裝置'],
  ['Dissipadores - Alumínio e cobre', 'Heat sinks - Aluminum and copper', '散熱片 - 鋁和銅'],
  ['Dissipadores de calor - Alumínio', 'Heat sinks - Aluminum', '散熱片 - 鋁'],
  ['Dissipadores de calor - Cobre', 'Heat sinks - Copper', '散熱片 - 銅'],
  ['Eletrônicos diversos', 'Miscellaneous electronics', '其他電子產品'],
  ['Equipamentos de escritório', 'Office equipment', '辦公設備'],
  ['Equipamentos domésticos', 'Household appliances', '家用設備'],
  ['Ferro', 'Iron', '鐵'],
  ['Fibra', 'Fiber', '纖維'],
  ['Fibra de vidro', 'Fiberglass', '玻璃纖維'],
  ['Fontes de alimentação (com cabo)', 'Power supplies (with cable)', '電源供應器（含線）'],
  ['Fontes de alimentação (sem cabo)', 'Power supplies (without cable)', '電源供應器（不含線）'],
  ['Fusíveis mistos', 'Mixed fuses', '混合保險絲'],
  ['Gabinete - Populado', 'Chassis - Populated', '機箱 - 含零件'],
  ['Gabinete - Vazio', 'Chassis - Empty', '機箱 - 空'],
  ['HD - Prensado', 'HDD - Crushed', '硬碟 - 壓扁'],
  ['HDs (inteiros)', 'HDDs (whole)', '硬碟（完整）'],
  ['HDs (triturados)', 'HDDs (shredded)', '硬碟（粉碎）'],
  ['Latas de aerossol', 'Aerosol cans', '噴霧罐'],
  ['Latão', 'Brass', '黃銅'],
  ['Lixo / Rejeito', 'Waste / Reject', '垃圾／廢料'],
  ['Lâmpadas de projetor nuas', 'Bare projector lamps', '裸投影機燈泡'],
  ['Material perigoso', 'Hazardous material', '危險物料'],
  ['Monitores - Sucata de LCD', 'Monitors - LCD scrap', '顯示器 - LCD 廢料'],
  [
    'Monitores - Sucata de tela plana plasma / LED',
    'Monitors - Plasma / LED flat panel scrap',
    '顯示器 - 電漿／LED 平面螢幕廢料',
  ],
  ['Monitores CRT', 'CRT monitors', 'CRT 顯示器'],
  [
    'Mídias de armazenamento (CDROM, DVD, fitas, disquetes)',
    'Storage media (CD-ROM, DVD, tapes, floppy disks)',
    '儲存媒體（CD-ROM、DVD、磁帶、磁碟片）',
  ],
  ['Papelão', 'Cardboard', '紙板'],
  ['Parafusos', 'Screws', '螺絲'],
  ['Placas de HD', 'HDD boards', '硬碟電路板'],
  ['Placas de circuito - Alto teor', 'Circuit boards - High grade', '電路板 - 高品位'],
  ['Placas de circuito - Baixo teor', 'Circuit boards - Low grade', '電路板 - 低品位'],
  ['Placas de circuito - Mistas', 'Circuit boards - Mixed', '電路板 - 混合'],
  ['Placas de circuito - Médio teor', 'Circuit boards - Medium grade', '電路板 - 中品位'],
  ['Placas de potência (inteiras)', 'Power boards (whole)', '電源板（完整）'],
  ['Placas de potência (trituradas)', 'Power boards (shredded)', '電源板（粉碎）'],
  ['Placas de set top box', 'Set-top box boards', '機上盒電路板'],
  ['Placas-mãe (inteiras)', 'Motherboards (whole)', '主機板（完整）'],
  ['Placas-mãe (trituradas)', 'Motherboards (shredded)', '主機板（粉碎）'],
  ['Plástico misto', 'Mixed plastic', '混合塑膠'],
  ['Processadores - Série 300', 'Processors - 300 series', '處理器 - 300 系列'],
  ['Racks', 'Racks', '機架'],
  ['Reator - sem PCB', 'Ballast - without PCB', '安定器 - 不含 PCB'],
  ['Reatores - com PCB', 'Ballasts - with PCB', '安定器 - 含 PCB'],
  ['Servidores', 'Servers', '伺服器'],
  ['Sucata de HD', 'HDD scrap', '硬碟廢料'],
  ['Sucata de SSD', 'SSD scrap', 'SSD 廢料'],
  ['Sucata de copiadoras', 'Copier scrap', '影印機廢料'],
  ['Sucata de equipamentos médicos', 'Medical equipment scrap', '醫療設備廢料'],
  ['Sucata de impressoras', 'Printer scrap', '印表機廢料'],
  ['Sucata de memórias', 'Memory scrap', '記憶體廢料'],
  ['Sucata de metal misto', 'Mixed metal scrap', '混合金屬廢料'],
  ['Sucata de processadores', 'Processor scrap', '處理器廢料'],
  ['Sucata de set top box / decodificadores', 'Set-top box / decoder scrap', '機上盒／解碼器廢料'],
  ['Sucata de smartphones', 'Smartphone scrap', '智慧型手機廢料'],
  ['Sucata de switches', 'Switch scrap', '交換器廢料'],
  ['Sucata de tablets', 'Tablet scrap', '平板電腦廢料'],
  ['TVs CRT', 'CRT TVs', 'CRT 電視'],
  ['Transformadores', 'Transformers', '變壓器'],
  ['Tubo CRT nu', 'Bare CRT tube', '裸 CRT 映像管'],
  [
    'Unidade de rádio - Banhada a prata sem berílio (BeO)',
    'Radio unit - Silver-plated without beryllium (BeO)',
    '無線電單元 - 鍍銀不含鈹（BeO）',
  ],
  ['Vidro', 'Glass', '玻璃'],
]

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('materiais')
    .addColumn('id', 'text', (c) => c.primaryKey())
    // LocalizedText em JSON
    .addColumn('nome', 'text', (c) => c.notNull())
    // nome em português (ordenar, buscar e impedir repetido)
    .addColumn('nome_ordem', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  await db.schema
    .createTable('areas_estoque')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('nome', 'text', (c) => c.notNull())
    // LocalizedText em JSON (opcional)
    .addColumn('descricao', 'text')
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  await db.schema
    .createTable('recipientes')
    .addColumn('id', 'text', (c) => c.primaryKey())
    // 'caixote' | 'pallet'
    .addColumn('tipo', 'text', (c) => c.notNull())
    .addColumn('ano', 'integer', (c) => c.notNull())
    .addColumn('numero', 'integer', (c) => c.notNull())
    // CXT-20260001 / PLT-20260001
    .addColumn('codigo', 'text', (c) => c.notNull().unique())
    .addColumn('material_id', 'text', (c) => c.notNull().references('materiais.id'))
    // kg
    .addColumn('tara_kg', 'real', (c) => c.notNull())
    .addColumn('area_id', 'text', (c) => c.notNull().references('areas_estoque.id'))
    .addColumn('posicao', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()
  await db.schema
    .createIndex('recipientes_numero_idx')
    .on('recipientes')
    .columns(['tipo', 'ano', 'numero'])
    .unique()
    .execute()
  await db.schema
    .createIndex('recipientes_material_idx')
    .on('recipientes')
    .column('material_id')
    .execute()
  await db.schema.createIndex('recipientes_area_idx').on('recipientes').column('area_id').execute()

  // Lista inicial de materiais (passada pelo usuário).
  const agora = new Date().toISOString()
  await db
    .insertInto('materiais' as never)
    .values(
      MATERIAIS.map(([pt, en, zh]) => ({
        id: randomUUID(),
        nome: JSON.stringify({
          origem: 'pt-BR',
          textos: { 'pt-BR': pt, en, 'zh-TW': zh },
          automaticos: ['en', 'zh-TW'],
        }),
        nome_ordem: pt,
        status: 'ativo',
        busca: normalizar(`${pt} ${en} ${zh}`),
        criado_em: agora,
        criado_por: 'Sistema',
        alterado_em: agora,
        alterado_por: 'Sistema',
      })) as never,
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('recipientes').execute()
  await db.schema.dropTable('areas_estoque').execute()
  await db.schema.dropTable('materiais').execute()
}
