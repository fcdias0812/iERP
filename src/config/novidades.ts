import type { Language } from '@/stores/ui-store'

/*
 * NOVIDADES de cada atualização do iERP (pedido do usuário, 27/10/2026: "Coloque o botão para ver
 * as novidades que tem em cada atualização"). Aparecem no botão Novidades da barra do topo; a
 * bolinha acende enquanto a pessoa não viu a versão mais nova.
 *
 * REGRA: toda entrega acrescenta uma versão NO TOPO desta lista (a primeira é a atual), com os
 * itens nos 3 idiomas, na mesma ordem e na linguagem de quem usa o sistema (o que muda para a
 * pessoa, não o código). O teste `novidades.test.ts` confere versões, datas e idiomas.
 */

export interface Novidade {
  /** "2.4" — sobe 0.1 a cada entrega. */
  versao: string
  /** Dia da entrega (AAAA-MM-DD). */
  data: string
  itens: Record<Language, string[]>
}

export const NOVIDADES: Novidade[] = [
  {
    versao: '2.4',
    data: '2026-10-27',
    itens: {
      'pt-BR': [
        'Vários caminhões no mesmo lote: no Agendamento ou pelo botão "Adicionar caminhão" no lote. Cada caminhão tem motorista, placa, link e código de chegada próprios.',
        'Aparelho de GPS no caminhão: lido do mesmo servidor de GPS do iERP 1.0. Os aparelhos aparecem em Cadastros › Rastreadores GPS e se ligam à viagem por "Usar rastreador".',
        'Lotes da mesma coleta (mesmo cliente, endereço e data) viram um lote só: o primeiro mostra tudo somado e a lista dos lotes juntados.',
        'Botão para abrir o lote no sistema de origem (Gerenciamento e MSDC) e no MoonShot depois do recebimento.',
        'Configurações do cliente: os tipos de documento que ele aceita no lote e os que vão no relatório final. Tipo novo se cria ali mesmo.',
        'Botão Gerar no lote: PDF da OS e o ZIP do relatório final (diz o que falta, se faltar).',
        'Telas usam toda a largura em monitores grandes e a barra do topo ficou translúcida.',
        'Este botão de Novidades.',
      ],
      en: [
        'Several trucks on the same lot: in Scheduling or with the "Add truck" button on the lot. Each truck has its own driver, plate, link and arrival code.',
        'GPS device on the truck: read from the same GPS server as iERP 1.0. Devices show up in Registries › GPS trackers and are linked to a trip with "Use tracker".',
        'Lots from the same pickup (same customer, address and date) become a single lot: the first one shows everything added up and the list of joined lots.',
        'Button to open the lot in its source system (Project Management and MSDC) and in MoonShot after receiving.',
        'Customer settings: the document types accepted on the lot and the ones that go in the final report. New types can be created right there.',
        'Generate button on the lot: work order PDF and the final report ZIP (it says what is missing, if anything).',
        'Screens use the full width on large monitors and the top bar is now translucent.',
        "This What's new button.",
      ],
      'zh-TW': [
        '同一批次可有多輛卡車：在排程中或使用批次中的「新增卡車」按鈕。每輛卡車都有自己的司機、車牌、連結與到達代碼。',
        '卡車上的 GPS 裝置：從與 iERP 1.0 相同的 GPS 伺服器讀取。裝置會出現在「基本資料 › GPS 追蹤器」，並以「使用追蹤器」連結到行程。',
        '同一次收運（相同客戶、地址與日期）的批次合併為一個：第一個批次顯示所有合計與合併批次清單。',
        '在來源系統（專案管理與 MSDC）開啟批次的按鈕，以及收貨後在 MoonShot 開啟。',
        '客戶設定：批次接受的文件類型，以及要放入最終報告的類型。可在該處直接建立新類型。',
        '批次的「產生」按鈕：工單 PDF 與最終報告 ZIP（若有缺少會說明）。',
        '大螢幕上畫面使用全寬，頂部列改為半透明。',
        '這個「最新消息」按鈕。',
      ],
    },
  },
  {
    versao: '2.3',
    data: '2026-10-22',
    itens: {
      'pt-BR': [
        'Clientes › Configurações: rastreio da coleta, regras do agendamento e do recebimento, prazos (SLA) e para qual sistema vão os lotes.',
        'Link de acompanhamento: o cliente vê os lotes dele numa página pública, em 3 idiomas.',
      ],
      en: [
        'Customer settings: pickup tracking, scheduling and receiving rules, deadlines (SLA) and which system the lots go to.',
        'Tracking link: the customer sees their lots on a public page, in 3 languages.',
      ],
      'zh-TW': [
        '客戶 › 設定：收運追蹤、排程與收貨規則、期限（SLA）以及批次要送往的系統。',
        '追蹤連結：客戶可在公開頁面以 3 種語言查看自己的批次。',
      ],
    },
  },
  {
    versao: '2.2',
    data: '2026-10-20',
    itens: {
      'pt-BR': [
        'Integração com o MoonShot (Dell): os lotes vão para lá depois do recebimento e o balanço de massa volta para o iERP.',
        'Lotes do Gerenciamento de Projetos e do MSDC (Microsoft) aparecem no iERP, só para ver.',
        'Ordens › Viagens: mapa ao vivo do caminhão, chat com o motorista, aviso de emergência e o trajeto das viagens finalizadas (GPX, KML e CSV).',
        'Estoque: Materiais, Assets, Peças e E-commerce lidos dos sistemas de estoque, com o histórico do que mudou.',
      ],
      en: [
        'MoonShot (Dell) integration: lots go there after receiving and the mass balance comes back to iERP.',
        'Lots from Project Management and MSDC (Microsoft) show up in iERP, view only.',
        'Orders › Trips: live truck map, chat with the driver, emergency alert and the route of finished trips (GPX, KML and CSV).',
        'Inventory: Materials, Assets, Parts and E-commerce read from the inventory systems, with the history of what changed.',
      ],
      'zh-TW': [
        '與 MoonShot（Dell）整合：批次收貨後送往該系統，質量平衡會回傳到 iERP。',
        '專案管理與 MSDC（Microsoft）的批次會顯示在 iERP，僅供檢視。',
        '訂單 › 運輸：卡車即時地圖、與司機聊天、緊急警示，以及已完成行程的路線（GPX、KML 與 CSV）。',
        '庫存：從庫存系統讀取物料、資產、零件與電商，並顯示變更歷史。',
      ],
    },
  },
  {
    versao: '2.1',
    data: '2026-10-19',
    itens: {
      'pt-BR': [
        'Operação › Dashboard: SLA por cliente, previsão de coletas, mapa e anomalias.',
        'Detalhe do lote em abas: informações, progresso, ocorrências, documentos e histórico.',
        'Operação › Recebimento: lacres, notas fiscais, inspeção e pallets com fotos.',
        'Históricos de Ordens e de Operação.',
        'Sistema › Cadastros: materiais, pallets, caixotes e áreas do estoque.',
        'Administração: Perfis de acesso e Auditoria.',
        'Busca no topo (Ctrl+K) encontra todos os registros.',
      ],
      en: [
        'Operations › Dashboard: SLA per customer, pickup forecast, map and anomalies.',
        'Lot detail in tabs: information, progress, incidents, documents and history.',
        'Operations › Receiving: seals, invoices, inspection and pallets with photos.',
        'Orders and Operations history.',
        'System › Registries: materials, pallets, crates and stock areas.',
        'Administration: Access profiles and Audit.',
        'The top search (Ctrl+K) finds every record.',
      ],
      'zh-TW': [
        '營運 › 儀表板：各客戶 SLA、收運預測、地圖與異常。',
        '批次明細分頁：資訊、進度、事件、文件與歷史。',
        '營運 › 收貨：封條、發票、檢查與附照片的棧板。',
        '訂單與營運歷史。',
        '系統 › 基本資料：物料、棧板、木箱與庫存區域。',
        '管理：存取權限設定檔與稽核。',
        '頂部搜尋（Ctrl+K）可找到所有紀錄。',
      ],
    },
  },
  {
    versao: '2.0',
    data: '2026-10-18',
    itens: {
      'pt-BR': [
        'Primeira versão do iERP 2.0.',
        'Clientes com contatos, sites e docas no mapa, documentos e histórico.',
        'Transportadoras, Veículos e Motoristas, com cadastro no painel lateral.',
        'Ordens › Agendamento com o pré-cálculo do caminhão e da equipe, e a lista de Lotes.',
        'Administração › Usuários.',
      ],
      en: [
        'First release of iERP 2.0.',
        'Customers with contacts, sites and docks on the map, documents and history.',
        'Carriers, Vehicles and Drivers, edited in the side panel.',
        'Orders › Scheduling with the truck and team pre-calculation, and the Lots list.',
        'Administration › Users.',
      ],
      'zh-TW': [
        'iERP 2.0 第一個版本。',
        '客戶資料，包含聯絡人、地圖上的據點與碼頭、文件與歷史。',
        '運輸公司、車輛與司機，於側邊面板編輯。',
        '訂單 › 排程，含卡車與人員預估，以及批次清單。',
        '管理 › 使用者。',
      ],
    },
  },
]

/** A versão atual (a primeira da lista). */
export const VERSAO_ATUAL = NOVIDADES[0]!.versao
