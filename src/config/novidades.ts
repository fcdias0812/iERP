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
    versao: '2.10',
    data: '2026-10-29',
    itens: {
      'pt-BR': [
        'Vários caminhões (ou vários celulares) no mesmo lote: cada um com o seu código no app do motorista (LOT-…, LOT-…-V2…). Antes, o segundo motorista era recusado pelo rastreador.',
        'O card do caminhão mostra o "Código no app" quando ele não é o código do lote.',
      ],
      en: [
        "Several trucks (or several phones) on the same lot: each one with its own code in the driver's app (LOT-…, LOT-…-V2…). Before, the tracker refused the second driver.",
        'The truck card shows the "Code in the app" when it is not the lot code.',
      ],
      'zh-TW': [
        '同一批次有多輛卡車（或多支手機）時，每輛在司機 App 中都有自己的代碼（LOT-…、LOT-…-V2…）。之前追蹤器會拒絕第二位司機。',
        '當代碼不是批次代碼時，卡車卡片會顯示「App 中的代碼」。',
      ],
    },
  },
  {
    versao: '2.9',
    data: '2026-10-28',
    itens: {
      'pt-BR': [
        'Quando sair uma versão nova do iERP, aparece um aviso para reiniciar a página agora ou continuar o que estiver fazendo (para não perder nada).',
        'Quem continua vê um "?" laranja no botão Novidades; lá dentro, o convite para reiniciar e ver as mudanças.',
      ],
      en: [
        'When a new iERP version is published, a notice offers to restart the page now or keep doing what you are doing (so nothing is lost).',
        'If you keep going, the What\'s new button shows an orange "?"; inside it, the invitation to restart and see the changes.',
      ],
      'zh-TW': [
        '發布新版 iERP 時，會出現提示：立即重新整理頁面，或繼續目前的工作（以免遺失資料）。',
        '若選擇繼續，「最新消息」按鈕會顯示橘色「?」；點開後可重新整理並查看變更。',
      ],
    },
  },
  {
    versao: '2.8',
    data: '2026-10-28',
    itens: {
      'pt-BR': [
        'Ordens › Viagens: botão "Nova viagem" para pôr mais um caminhão numa ordem já agendada, com o rastreador (celular do motorista ou aparelho de GPS).',
        'Vários rastreadores no mesmo caminhão: "Adicionar rastreador" no card. O card continua sendo um por caminhão e mostra cada rastreador com a sua situação.',
        'O mesmo aparelho de GPS pode ir em duas ordens do mesmo cliente no mesmo dia.',
        'Leitura do servidor de GPS a cada 5 minutos; se falhar, tenta de novo em 1 minuto.',
        'Ordens da mesma coleta juntam também os caminhões: mesma placa = o mesmo caminhão (os rastreadores se somam no card); outra placa ou sem placa = mais um caminhão da coleta.',
        'No Agendamento, a ordem da mesma coleta avisa com qual lote vai junto e mostra os caminhões que já existem.',
      ],
      en: [
        'Orders › Trips: "New trip" button to add one more truck to an order already scheduled, with its tracker (driver\'s phone or GPS device).',
        'Several trackers on the same truck: "Add tracker" on the card. There is still one card per truck, showing each tracker and its status.',
        'The same GPS device can go on two orders of the same customer on the same day.',
        'The GPS server is read every 5 minutes; if a read fails, it tries again in 1 minute.',
        'Orders of the same pickup now join their trucks too: same plate = the same truck (its trackers add up on the card); another plate or no plate = one more truck in the pickup.',
        'In Scheduling, an order of the same pickup shows which lot it goes with and the trucks that already exist.',
      ],
      'zh-TW': [
        '訂單 › 行程：「新增行程」按鈕，可為已排程的訂單再加一輛卡車與追蹤器（司機手機或 GPS 裝置）。',
        '同一輛卡車可有多個追蹤器：在卡片上「新增追蹤器」。每輛卡車仍是一張卡片，並顯示每個追蹤器的狀態。',
        '同一個 GPS 裝置可用於同一客戶同一天的兩張訂單。',
        '每 5 分鐘讀取一次 GPS 伺服器；讀取失敗時，1 分鐘後再試。',
        '同一次收運的訂單也會合併卡車：相同車牌 = 同一輛卡車（追蹤器在卡片上相加）；不同車牌或沒有車牌 = 收運中多一輛卡車。',
        '在排程中，同一次收運的訂單會顯示與哪個批次合併，以及已有的卡車。',
      ],
    },
  },
  {
    versao: '2.7',
    data: '2026-10-27',
    itens: {
      'pt-BR': [
        'Etiqueta de pallet no Recebimento: ao salvar um recebimento novo, sai uma etiqueta por pallet (100 × 70 mm) com cliente, lote, data, pesos e o QR code do lote. O recebimento só é concluído depois de abrir a impressão.',
        'Etiqueta perdida ou rasgada? No lote, menu Gerar › Etiquetas dos pallets imprime de novo com os pesos gravados.',
      ],
      en: [
        'Pallet labels at Receiving: when saving a new receiving, one label per pallet (100 × 70 mm) is printed with customer, lot, date, weights and the lot QR code. Receiving is only completed after the print window opens.',
        'Lost or torn label? On the lot, Generate › Pallet labels prints them again with the recorded weights.',
      ],
      'zh-TW': [
        '收貨時的棧板標籤：儲存新的收貨時，每個棧板列印一張標籤（100 × 70 mm），含客戶、批次、日期、重量與批次的 QR code。開啟列印後才能完成收貨。',
        '標籤遺失或破損？在批次的「產生 › 棧板標籤」可用已記錄的重量重新列印。',
      ],
    },
  },
  {
    versao: '2.6',
    data: '2026-10-27',
    itens: {
      'pt-BR': [
        'Excluir lote: o lote agendado sai pelo botão Excluir do lote (digite o código para confirmar). Depois do recebimento, ou com caminhão já na rua, não dá mais.',
        'O lote principal leva junto os lotes daqui da mesma coleta. Um lote juntado também sai sozinho, pela lista "Lotes juntados".',
        'O lote excluído some das listas e dos painéis, mas continua na Auditoria e nos Históricos com a marca "excluído". O código dele nunca volta a ser usado.',
      ],
      en: [
        'Delete lot: a scheduled lot can be removed with the Delete button on the lot (type the code to confirm). After receiving, or with a truck already on the road, it no longer can.',
        'The main lot takes along the lots from here in the same pickup. A joined lot can also be deleted on its own, from the "Joined lots" list.',
        'A deleted lot disappears from lists and dashboards, but stays in the Audit log and the Histories marked "deleted". Its code is never reused.',
      ],
      'zh-TW': [
        '刪除批次：已排程的批次可使用批次中的「刪除」按鈕移除（輸入代碼確認）。收貨後或卡車已出發時則無法刪除。',
        '主批次會一併刪除同一次收運中來自此系統的批次。合併的批次也可在「合併的批次」清單中單獨刪除。',
        '已刪除的批次會從清單與儀表板消失，但仍以「已刪除」標記保留在稽核與歷史中。其代碼永遠不會再被使用。',
      ],
    },
  },
  {
    versao: '2.5',
    data: '2026-10-27',
    itens: {
      'pt-BR': [
        'Clientes › Visão geral virou o painel do cliente: lotes a chegar, em operação, concluídos, kg e pallets recebidos.',
        'Gráficos de coletas e kg por mês, lotes por etapa, kg por material (balanço de massa) e ocorrências por tipo.',
        'Prazo (SLA) do cliente: quanto foi concluído no prazo, tempo médio até o COD e os lotes já atrasados.',
        'Período à escolha: 30 dias, 90 dias, 12 meses ou tudo. Os últimos lotes abrem direto no lote.',
      ],
      en: [
        'Customers › Overview is now the customer dashboard: lots arriving, in operation, completed, kg and pallets received.',
        'Charts of pickups and kg per month, lots by stage, kg per material (mass balance) and incidents by type.',
        'Customer deadline (SLA): how much was completed on time, average time to COD and lots already late.',
        'Pick the period: 30 days, 90 days, 12 months or all. The latest lots open straight into the lot.',
      ],
      'zh-TW': [
        '客戶 › 總覽變成客戶儀表板：即將到達、作業中、已完成的批次，以及已收公斤數與棧板。',
        '每月收運與公斤數、各階段批次、各物料公斤數（質量平衡）與各類型事件圖表。',
        '客戶期限（SLA）：準時完成的比例、到 COD 的平均時間與已逾期的批次。',
        '可選擇期間：30 天、90 天、12 個月或全部。最近的批次可直接開啟。',
      ],
    },
  },
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
