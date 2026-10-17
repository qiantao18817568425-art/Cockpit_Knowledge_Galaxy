import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const save=async(file,value)=>writeFile(path.join(root,file),JSON.stringify(value,null,2)+'\n','utf8');
const sourceRegister=await read('content/source-register.json');
const sourcePlatformById=new Map(sourceRegister.documents.map(item=>[item.id,item.platform]));

function splitPlatformClaims(pack){
  const evidenceById=new Map();
  for(const item of pack.evidence||[]){
    const platform=sourcePlatformById.get(item.sourceId);
    item.platforms=item.platforms?.filter(value=>value==='MT8668'||value==='MT8676')||[];
    if(!item.platforms.length&&(platform==='MT8668'||platform==='MT8676'))item.platforms=[platform];
    evidenceById.set(item.id,item);
  }
  const claims=[];
  for(const claim of pack.claims||[]){
    if(claim.status!=='documented_reference'){claims.push(claim);continue;}
    const declared=(claim.platforms||[]).filter(value=>value==='MT8668'||value==='MT8676');
    const covered=new Set((claim.evidenceIds||[]).flatMap(id=>evidenceById.get(id)?.platforms||[]));
    const documented=declared.filter(platform=>covered.has(platform));
    const missing=declared.filter(platform=>!covered.has(platform));
    if(documented.length){
      const evidenceIds=(claim.evidenceIds||[]).filter(id=>(evidenceById.get(id)?.platforms||[]).some(platform=>documented.includes(platform)));
      claims.push({...claim,platforms:documented,evidenceIds});
    }
    if(missing.length)claims.push({...claim,id:`${claim.id}:inferred`,platforms:missing,status:'inferred_mapping'});
    if(!declared.length)claims.push({...claim,status:'inferred_mapping'});
  }
  pack.claims=claims;
  return pack;
}

function knowledge(role,input,mechanism,output,observations,limits=['具体接口启用范围、VMID、通道编号与当前车型版本待项目资料确认']){
  return {role,input,mechanism,output,observations,limits};
}

const platformKnowledge={
  'domain:platform':knowledge('定义座舱 SoC 平台范围、共性能力和平台差异，是所有运行域与功能链的硬件和版本坐标。',['车型、SoC 与软硬件版本定义'],['区分共享能力、平台变体与未确认配置'],['可供各知识分支引用的平台适用范围'],['SoC 型号、板级版本和软件基线']),
  'domain:virtualization':knowledge('描述 Hypervisor 对 Guest、Host、虚拟设备和生命周期的隔离与调度边界。',['VM 配置、物理资源和启动/休眠请求'],['划分 vCPU、内存、中断及虚拟 I/O 责任'],['Guest 可运行环境和跨域资源边界'],['VM generation、Guest 状态和虚拟设备状态']),
  'domain:android':knowledge('承载 AAOS Framework、系统服务、应用和 Android 域内 IPC。',['车辆服务输入、设备能力和应用请求'],['通过 Framework、Binder 与 HAL 组织业务'],['HMI、音频、连接等用户功能结果'],['system_server、Binder、服务 Ready 与业务日志']),
  'domain:yocto':knowledge('作为 Host 承担物理设备、平台服务、共享资源和部分跨域服务。',['物理设备状态、Guest 请求和车辆侧消息'],['调度 Host 服务、设备驱动与跨域路由'],['设备控制结果和送往 Guest/外域的服务数据'],['Host 服务状态、驱动计数和路由日志']),
  'domain:mcu':knowledge('承担车辆信号采集、实时控制、电源策略和 SoC 外部控制。',['车辆总线、离散输入和电源状态'],['执行实时状态机并通过板级接口与 SoC 交互'],['车辆状态、唤醒/休眠控制和执行结果'],['CAN/E2E、心跳、重启原因和接口状态']),
  'domain:cross-domain':knowledge('定义 Android、Yocto、MCU、TBox 与虚拟机之间的消息、状态和数据交接。',['跨域请求、事件、状态与数据'],['通过明确的传输接口完成序列化、路由和消费'],['接收域可验证的消息或状态更新'],['sequence、request ID、时间戳、发布与消费日志']),
  'component:hypervisor':knowledge('隔离并调度 Host 与 Guest，管理虚拟资源和 VM 生命周期。',['平台资源、VM 配置和生命周期请求'],['建立运行域隔离并提供虚拟设备/通道'],['Host/Guest 运行状态和虚拟资源交付'],['VM create/destroy、generation、vCPU 和 virtio 状态']),
  'component:yocto-host':knowledge('持有物理设备与 Host 服务，为 Guest 和外部域提供平台能力。',['设备中断、驱动状态、跨域请求'],['运行驱动、服务和消息路由'],['设备结果、服务状态与跨域发布'],['Host boot、服务 Ready、驱动和 FDBus 日志']),
  'component:mcu':knowledge('执行实时车身与电源控制，并把车辆状态交给座舱 SoC。',['CAN/CANFD、GPIO、唤醒与电源输入'],['实时状态机、E2E 校验和板级接口控制'],['车辆状态、心跳和 SoC 控制请求'],['MCU tick、心跳、重启原因、总线与接口错误']),
  'component:tbox':knowledge('承载蜂窝通信、远控和车联网业务，并与座舱域交换服务状态。',['Modem/网络状态、云端或车辆请求'],['运行通信协议与远控业务'],['SOME/IP 服务、远控结果和唤醒请求'],['网络注册、服务发现、请求 ID 和业务回执']),
  'interface:binder':knowledge('在 Android Guest 内部连接进程、Framework 服务与客户端。',['Android 进程发起的事务和对象引用'],['Binder 驱动与线程池完成域内 IPC'],['目标 Android 进程收到的事务或返回值'],['binder transaction、线程池、死亡通知和超时'],['Binder 在本知识模型中是 Android 域内接口；跨域映射需单独证据']),
  'interface:fdbus':knowledge('承载 Host 服务与其他运行域之间的发布、订阅和请求消息。',['服务发布、订阅和消息负载'],['按 channel/topic 路由并维护连接'],['消费者收到的消息与状态更新'],['连接状态、topic、sequence 与两端时间戳']),
  'interface:someip':knowledge('承载以太网服务发现、方法、事件与状态数据。',['服务实例、事件或方法请求'],['SOME/IP 与服务发现完成寻址和交付'],['目标 ECU/进程收到的服务数据'],['SD offer/find、method/event、sequence 和 freshness']),
  'interface:vsock':knowledge('在虚拟机边界上传递 Guest 与 Host 的请求或数据。',['Guest/Host 请求与负载'],['通过 VM socket 通道完成寻址和收发'],['对端进程收到的消息或响应'],['CID/端口、request ID、收发返回和 VM generation']),
  'interface:virtio':knowledge('向 Guest 提供标准化虚拟设备和 virtqueue 数据交换。',['Guest 驱动请求与描述符'],['Host backend 与 virtqueue 协同处理'],['虚拟设备完成通知与数据'],['virtqueue index、kick/callback、descriptor 和 backend 状态']),
  'observation:sequence':knowledge('用连续序号识别跨域消息是否丢失、乱序或重复。',['消息 sequence'],['对比发送端与接收端的同一序列'],['首个断点和丢失区间'],['两端 sequence 日志和重启边界']),
  'observation:freshness':knowledge('用时间戳或 freshness 判断状态是否仍有效。',['状态时间戳、计数器或 freshness 字段'],['统一时间基准后比较产生、传输与消费时刻'],['陈旧状态、延迟或更新停止的判断'],['两端时间戳、时钟偏差和最后更新时间']),
  'observation:boot-generation':knowledge('把日志和消息绑定到同一次启动或 VM 实例，避免跨代拼接因果。',['boot ID、VM generation 和重建事件'],['划分运行周期并拒绝跨代关联'],['同一生命周期内的证据时间线'],['boot ID、VM create/destroy 与服务重连记录']),
  'observation:request-id':knowledge('把一次请求在发送、路由、处理和响应阶段关联起来。',['request ID 或 transaction ID'],['在各端追踪同一标识'],['请求是否到达、处理和返回的分段结论'],['客户端、通道与服务端同一 ID 的日志'])
};

const runtimeRelations={
  'rel:runtime:001':['Hypervisor 约束 Host 的启动、资源与生命周期边界，使 Yocto Host 在受控平台环境中运行。','VM/Host 配置与生命周期请求','Hypervisor 到 Yocto Host 的虚拟化管理边界','可运行的 Host 环境',['Hypervisor 启动记录与 Host boot/generation 对齐']],
  'rel:runtime:002':['MT8676 与 MT8668 属于相邻平台族，共享座舱能力模型，但实现参数和版本差异必须分别核对。','两平台资料中的能力与版本定义','平台变体对照，不表示参数可直接互换','共性能力与差异清单',['两平台原始资料分别定位并标出相同项/差异项']],
  'rel:runtime:003':['Android Guest 由 Hypervisor 提供隔离运行环境与虚拟资源，因此其生命周期必须关联所属 VM generation。','Android VM 配置与启动请求','Android Guest 到 Hypervisor 的 VM 边界','Android Guest 运行实例',['VM create/start 与 Android boot ID 对齐']],
  'rel:runtime:004':['Yocto Host 通过 FDBus 发布 Host 服务或状态，使订阅方能够跨进程或跨域消费。','Host 服务状态或消息负载','Yocto 服务到 FDBus channel/topic','可被订阅方接收的发布消息',['发布日志、topic/sequence 与消费端日志对应']],
  'rel:runtime:005':['Android Guest 内部服务通过 Binder 暴露事务接口，该关系限定在 Android 进程边界内。','Android 服务事务与对象引用','Android Guest 内的 Binder 进程间边界','客户端收到的事务结果',['Binder transaction、服务注册与客户端返回']],
  'rel:runtime:006':['TBox 通过 SOME/IP 暴露或消费车联网服务，使座舱域能够获取网络与远控状态。','TBox 服务状态或业务消息','TBox 到车载以太网 SOME/IP 服务边界','SOME/IP 事件、方法结果或服务状态',['服务发现、实例 ID、请求与回执对齐']],
  'rel:runtime:007':['Android Guest 通过 Vsock 向 Host 或其他 VM 发送请求，跨越虚拟机隔离边界。','Guest 请求、request ID 与负载','Android Guest 到 Host/VM 的 Vsock 通道','对端收到的请求或返回',['两端 CID/端口、request ID 与 VM generation 对齐']],
  'rel:runtime:008':['Android Guest 的虚拟设备访问依赖 virtio 前后端和 virtqueue 正常推进。','Guest 驱动描述符与设备请求','Guest virtio frontend 到 Host backend','设备数据与完成通知',['virtqueue kick/callback、index 与 backend 状态']],
  'rel:runtime:009':['MCU 通过 SPI/IPCL 向 SoC 发送实时控制或状态消息，形成板级跨域控制通道。','MCU 状态、控制请求和序号','MCU 到 SoC 的 SPI/IPCL 板级边界','Host/SoC 收到的控制或状态消息',['MCU 与 Host 两端 sequence、中断和收发计数']],
  'rel:runtime:010':['FDBus 消息的 sequence 可证明发布后是否连续到达消费端。','FDBus 消息序号','消息流到诊断观测的映射','丢失、乱序或重复区间',['发送与接收端同一 sequence 对照']],
  'rel:runtime:011':['SOME/IP 状态需要用 freshness 或时间戳判断是否仍代表当前车辆状态。','SOME/IP 事件与时间戳','服务消息到时效性观测','状态新鲜度结论',['发布、网络接收与消费时间统一基准']],
  'rel:runtime:012':['Hypervisor 的 VM 事件必须绑定 boot/VM generation，才能区分重建前后的不同运行实例。','VM 生命周期事件','虚拟化状态到运行周期间的关联','本次 VM 实例的证据边界',['VM generation、create/destroy 与 Guest boot 对齐']],
  'rel:runtime:013':['Vsock 请求用 request ID 贯穿 Guest、通道和对端处理，便于定位最早未交付阶段。','Vsock 请求与 request ID','跨 VM 通道到事务观测','请求分段交付结果',['Guest send、Host receive、response 使用同一 ID']]
};

const platform=await read('content/domain-packs/platform-runtime.json');
for(const entity of platform.entities){entity.knowledge=platformKnowledge[entity.id]||knowledge(`${entity.title} 在 ${entity.domain} 架构域中的职责。`,['上游输入待当前资料确认'],['按所属运行域完成处理'],['向下游交付结果'],['两端状态与日志']);}
for(const relation of platform.relations){const item=runtimeRelations[relation.id];if(!item)continue;[relation.why,relation.input,relation.handoff,relation.output,relation.verification]=item;}
splitPlatformClaims(platform);
await save('content/domain-packs/platform-runtime.json',platform);

const taxonomy=await read('content/power-taxonomy.json');
const taxonomyById=new Map(taxonomy.map(item=>[item.id,item]));
const rootOf=item=>item.parent?rootOf(taxonomyById.get(item.parent)):item.id;
const taxonomyFlow={
  inputs:['车辆 ACC/点火和状态输入','完成状态有效性、消抖与目标电源态判定','向 MCU/SoC 电源策略交付明确目标','输入值、有效时刻、目标态与门槛结果'],
  mcu:['车辆状态和目标电源态','MCU 状态机执行请求、应答和回读','向 SoC 与板级电源接口交付控制结果','MCU 状态、握手序号、接口反馈与实际供电'],
  supply:['主电、备电和 PMIC 控制条件','区分供电来源、软件状态与真实电源轨','形成可测量的电压、电流与保持结果','PMIC 状态、电源轨、电流和备电切换'],
  boot:['上电与复位条件','依次建立 Host、VM、服务和首帧','形成可用的座舱业务','各启动阶段、Ready、首帧和业务结果'],
  'host-guest':['休眠请求与各运行域当前状态','Host/Guest/Hypervisor 汇聚完成条件','允许进入内核和更深低功耗','各域 ack、barrier、VM generation 与超时'],
  suspend:['已满足的跨域休眠门槛','执行冻结、设备 suspend、noirq 与平台进入','进入稳定低功耗驻留或给出 abort','wakelock、设备回调、时钟、驻留与电流'],
  wake:['休眠尝试、唤醒请求与硬件中断','区分 abort、快速唤醒和稳定休眠后的真实唤醒','产生有效 wake reason 并启动恢复','wake source、IRQ、驻留时长和同一 boot 关联'],
  tbox:['RTC、Modem、远控和保持策略','维持或重建通信并按策略发起唤醒','向座舱域交付唤醒与业务请求','定时、网络注册、远控 request ID 和供电保持'],
  resume:['有效唤醒与新运行周期状态','按 Host、设备、VM、服务和订阅顺序恢复','形成用户可见的业务恢复结果','resume 阶段、资源重建、状态回读和业务验收'],
  diagnostics:['同一次 boot 和 suspend attempt 的跨域证据','统一时间基准并定位最早可证实断点','形成可复核的直接失效与证据缺口','阶段日志、驻留、电流、wake reason 和持久化结果']
};
for(const item of taxonomy){
  const [input,mechanism,output,observation]=taxonomyFlow[rootOf(item)]||taxonomyFlow.diagnostics;
  item.knowledge={role:item.description,input:[input],mechanism:[mechanism],output:[output],observations:[observation],limits:['状态名、MCU 码值、GPIO/IRQ、tick 单位、电源轨与阈值均按本次车型和版本验证']};
}
await save('content/power-taxonomy.json',taxonomy);

const power=await read('content/domain-packs/power.json');
const powerRoles={
  'domain:power':'组织车辆输入、MCU/SoC 握手、Host/Guest 屏障、内核挂起、真实低功耗、唤醒和业务恢复。',
  'platform:mt8668':'标识 MT8668 平台适用范围，用于约束资料与实现差异。','platform:mt8676':'标识 MT8676 平台适用范围，用于约束资料与实现差异。',
  'component:vehicle-power-input':'汇集 ACC、点火与车辆状态，作为电源策略的外部触发。','component:mcu-power-manager':'在 MCU 侧判定目标电源态并组织与 SoC 的请求、应答和板级控制。',
  'interface:gpio-wake':'承载板级唤醒或电源控制的离散信号与中断。','interface:spi-ipcl':'承载 MCU 与 SoC 之间的电源控制消息和状态回读。',
  'component:yocto-sleep-manager':'在 Yocto Host 汇聚休眠条件并协调后续 Hypervisor/内核阶段。','component:hypervisor-barrier':'等待相关 Guest/VM 完成休眠准备，再允许 Host 进入更深阶段。',
  'component:hypervisor-suspend-v11':'保留 Hypervisor Suspend V1.1 版本流程，供差异核对。','component:hypervisor-suspend-v13':'保留 Hypervisor Suspend V1.3 版本流程，供差异核对。',
  'component:android-guest':'执行 Android 应用、Framework 与设备服务的休眠准备和恢复。','component:tbox-guest':'按通信保持策略完成 TBox Guest 的休眠、保活或恢复。',
  'process:kernel-suspend':'执行 Linux 冻结、设备 suspend、late/noirq 与平台挂起阶段。','component:atf':'在安全固件层承接内核低功耗请求并进入平台电源管理。',
  'component:spm':'控制 SoC 低功耗模式、时钟与电源域进入条件。','component:pmic':'把平台电源控制转换为可测量的电源轨结果。','component:mt6363':'执行 MT6363 Buck/LDO 的具体供电输出。',
  'state:power-active':'表示系统与业务处于活动运行状态。','state:power-suspend-entry':'表示休眠请求已进入准备和挂起流程但尚未证明低功耗驻留。',
  'state:power-suspended':'表示平台已满足条件并进入稳定低功耗驻留。','state:power-resume':'表示有效唤醒后正在恢复设备、VM、服务和业务。',
  'observation:wake-source':'记录内核识别的唤醒来源并与本次休眠尝试关联。','observation:framework-wake':'记录 Framework 层的唤醒请求或恢复触发。',
  'observation:suspend-abort':'证明系统在完成低功耗驻留前中止本次 suspend。','observation:wake-after-suspend':'证明平台曾进入 suspend 后又发生有效唤醒。',
  'component:backup-power':'在主电变化时为规定域提供备电或保持供电。'
};
const powerById=new Map(power.entities.map(item=>[item.id,item]));
for(const entity of power.entities){
  const incoming=power.relations.filter(item=>item.to===entity.id).map(item=>powerById.get(item.from)?.title||item.from);
  const outgoing=power.relations.filter(item=>item.from===entity.id).map(item=>powerById.get(item.to)?.title||item.to);
  const input=incoming.length?incoming.map(title=>`来自「${title}」的状态、请求或结果`):['所属电源阶段的触发条件与版本范围'];
  const output=outgoing.length?outgoing.map(title=>`交付给「${title}」的状态、控制或结果`):['本阶段可验证的状态或物理结果'];
  const mechanism=entity.kind==='state'?['按进入条件、驻留条件和退出条件维护生命周期状态']:entity.kind==='observation'?['绑定同一 boot、VM generation 和 suspend attempt 后解释观测']:entity.kind==='interface'?['在接口两端完成发送、接收与反馈核对']:['执行所属电源阶段的处理并保留输入、状态和输出证据'];
  entity.knowledge=knowledge(powerRoles[entity.id],input,mechanism,output,[`${entity.title} 的输入、内部状态、输出及同一运行周期证据`],['MCU 码值、GPIO/IRQ、tick 单位、固定阈值和现车接线均不得脱离当前版本字典解释']);
}
const powerRelations={
  'rel:power:001':['车辆电源输入只有被 MCU 电源策略采集并判定后，才会形成座舱上下电或休眠目标。','ACC/点火与车辆状态','车辆输入到 MCU PowerManager 的策略边界','MCU 可执行的目标电源态',['输入有效时刻、MCU 采集值和目标态一致']],
  'rel:power:002':['MCU PowerManager 根据策略驱动唤醒/控制接口，但软件命令必须与板级信号结果分别验证。','MCU 目标态与控制命令','MCU 状态机到 GPIO/Wake IRQ 板级边界','可测量的离散控制或中断状态',['MCU 命令、GPIO/IRQ 电平和对端识别一致']],
  'rel:power:003':['MCU 通过 SPI/IPCL 把电源请求和状态交给 SoC，形成跨芯片握手的发送阶段。','MCU 电源请求、状态与序号','MCU 到 SoC 的 SPI/IPCL 边界','SoC 可接收的电源控制消息',['两端 sequence、中断、发送和接收计数对齐']],
  'rel:power:004':['SPI/IPCL 接收的电源消息需要交给 Yocto SleepManager，才能进入 Host 侧休眠协调。','SoC 收到的 MCU 电源消息','SPI/IPCL 接收端到 Yocto 服务边界','SleepManager 可处理的休眠或唤醒事件',['通道接收与 SleepManager 处理使用同一消息标识']],
  'rel:power:005':['Yocto SleepManager 汇聚 Host 条件后驱动 Hypervisor 屏障，开始跨 VM 完成条件检查。','Host 休眠目标和准备状态','Yocto 服务到 Hypervisor 生命周期边界','跨 VM suspend barrier 请求',['SleepManager 请求、barrier 建立和超时记录']],
  'rel:power:006':['Hypervisor 屏障必须等待 Android Guest 完成其休眠准备，避免共享资源仍在使用。','barrier 请求和 Android VM 状态','Hypervisor 到 Android Guest 生命周期边界','Android Guest 完成或阻塞状态',['VM generation、请求、ack 和超时对应']],
  'rel:power:007':['Hypervisor 屏障同时纳入 TBox Guest 的保持或休眠要求，通信域策略需单独验证。','barrier 请求和 TBox 保活策略','Hypervisor 到 TBox Guest 生命周期边界','TBox Guest 完成、保持或阻塞状态',['TBox 策略、VM 状态与 barrier 结果对应']],
  'rel:power:008':['各运行域满足屏障后才进入 Kernel Suspend，VM 完成不等于硬件已经低功耗。','跨 VM 完成状态','Hypervisor/Host 协调到 Linux suspend 入口','内核 suspend attempt',['barrier 完成与内核 suspend entry 时间连续']],
  'rel:power:009':['V1.1 与 V1.3 资料描述存在版本差异，因此保留冲突以避免混用时序和条件。','两个版本的 suspend 流程定义','版本对照边界','明确的共性、差异和待确认当前版本',['两版原文逐项对照并绑定现车软件基线']],
  'rel:power:010':['Kernel Suspend 完成设备阶段后把平台低功耗请求交给 ATF。','内核 suspend 与平台进入条件','Linux 内核到安全固件边界','ATF 可执行的低功耗请求',['内核最后阶段与 ATF 入口时间、返回值对应']],
  'rel:power:011':['ATF 校验平台条件后控制 SPM 进入相应 SoC 低功耗模式。','安全固件低功耗参数','ATF 到 SPM 平台电源控制边界','SPM 模式与控制请求',['ATF 调用、SPM 状态和失败码']],
  'rel:power:012':['SPM 控制 PMIC/电源域进入目标状态，软件完成消息需由实际电源结果验证。','SPM 低功耗模式和电源域控制','SoC 电源控制到 PMIC 边界','PMIC 电源轨目标状态',['SPM 状态、PMIC 寄存器与电压/电流测量']],
  'rel:power:013':['PMIC 通过 MT6363 Buck/LDO 输出具体电源轨，决定物理供电结果。','PMIC 电源轨配置','PMIC 控制到 MT6363 输出级','可测量的 Buck/LDO 电压与保持状态',['配置、PG/状态与板级测点一致']],
  'rel:power:014':['Backup Power 在主电变化时维持规定电源域，但保持范围不能由软件状态推定。','备电输入与切换条件','备电源到 PMIC/保持电源域','规定时间内的供电保持结果',['主备切换、PMIC 状态、电压与电流曲线']],
  'rel:power:015':['Active 收到有效目标态并满足门槛后进入 Suspend Entry，表示流程开始而非已经睡着。','活动态和有效休眠触发','电源状态机进入条件','Suspend Entry 状态',['目标态、门槛和状态迁移时间']],
  'rel:power:016':['Suspend Entry 只有在跨域、设备和平台条件全部完成后才能进入 Suspended。','各阶段完成条件','软件准备到稳定低功耗驻留边界','Suspended 状态',['最后完成项、平台进入和驻留证据']],
  'rel:power:017':['Suspended 在有效 wake source 到达后转入 Resume，需先证明此前真实驻留。','稳定低功耗状态和有效唤醒源','硬件唤醒到恢复状态机','Resume 状态',['驻留时长、wake reason 与 resume 入口']],
  'rel:power:018':['Resume 完成设备、VM、服务和业务恢复后返回 Active。','恢复阶段完成状态','恢复状态机到活动业务边界','Active 与业务可用结果',['设备/VM/服务 Ready 及用户功能验收']],
  'rel:power:019':['Kernel Suspend 的 wake source 记录用于判断请求后最早唤醒或阻塞位置。','本次 suspend attempt','内核流程到 wake source 观测','唤醒来源或无来源的证据缺口',['同一 boot 的 suspend 日志、IRQ 与 wakeup_sources']],
  'rel:power:020':['Active 阶段的 framework_wake 说明上层发起或保持唤醒，但不能单独证明硬件已睡醒。','Framework 唤醒请求','Android Framework 到电源诊断时间线','上层唤醒触发记录',['调用方、时间戳与底层状态关联']],
  'rel:power:021':['Suspend Entry 出现 suspend_abort 表明流程在驻留前中止，应定位最早未完成阶段。','进入中的 suspend attempt','挂起阶段到 abort 观测','中止阶段与直接阻塞证据',['abort 原因、设备回调、wakelock 和返回码']],
  'rel:power:022':['Suspended 后出现 wake_after_suspend 可证明先睡后醒，再继续核对真实唤醒源。','已确认的低功耗驻留','稳定休眠到唤醒观测','有效唤醒时间与来源',['驻留、IRQ/wake reason 和 resume 时间线']]
};
for(const relation of power.relations){
  if(relation.type==='transitions_to')relation.pathClass='state';
  const item=powerRelations[relation.id];if(item)[relation.why,relation.input,relation.handoff,relation.output,relation.verification]=item;
}
splitPlatformClaims(power);
await save('content/domain-packs/power.json',power);

const remainingRoles={
  'domain:hmi':'组织座舱界面、输入和用户可见反馈，并把显示、触摸、Camera 与音频体验关联到各自技术链。','domain:display':'组织 Android 合成、Host scanout、物理屏、背光和触摸输入边界。','domain:camera':'组织 Camera 控制、视频帧、AVM 拼接和多路帧观测。','domain:audio':'组织播放、采集、AEC 参考、DSP 和功放方向的音频链。',
  'interface:input-event':'把触摸或输入设备事件交给 Android 输入框架进行分发。','component:camera-control':'下发 Camera 启停、流配置和 AVM 业务控制，不承载视频帧本身。','interface:camera-frame':'承载传感器到处理/拼接阶段的视频帧和时序信息。','component:avm-stitch':'对多路 Camera 帧进行同步、拼接并形成环视输出。','observation:camera-four-stream':'同时检查四路输入的帧计数、时间连续性和缺帧情况。','process:audio-playback':'把应用或系统音频经策略、路由和 DSP 送往输出设备。','process:audio-capture':'把麦克风采集数据经前处理送往语音或录音消费者。','component:aec-reference':'向 AEC 提供与实际播放对应的 Echo Reference，避免回声和 TTS 回灌。','component:dsp-variant':'表示片内 ADSP 或外部 DSP 的项目实现差异，参数不可直接互换。',
  'domain:tbox':'组织 Modem、车联网、远控和独立唤醒相关能力。','domain:connectivity':'组织以太网、Wi-Fi、热点和手机互联的分层连通性。','domain:lifecycle':'区分冷启动、STR 恢复、VM 重建和单进程重启的运行周期。','domain:usb-storage':'组织 Type-C/USB 连接、控制器、块设备和文件系统层级。','domain:security':'组织 TEE 传输、安全服务和安全存储边界。',
  'component:ethernet-pcs':'完成 SGMII/PCS 编码、对齐和链路状态，为外部 PHY 提供数字侧连接。','component:ethernet-phy':'完成物理介质收发与载波状态，向上提供可用以太网链路。','process:l3-connectivity':'在物理链路之上建立地址、路由和可达性。','component:wifi-sta':'作为客户端关联外部 AP 并建立 WLAN 接入。','component:wifi-softap':'作为车机热点为手机互联或终端提供无线接入。','process:phone-link':'在网络连接之上建立 HiCar/CarLink 等手机互联业务。','component:modem':'维持蜂窝注册与数据通道，为远控和车联网提供广域连接。','process:remote-wake':'接收远端请求并按电源策略触发座舱或相关域唤醒。','state:cold-boot':'表示从完整上电开始重新建立 Host、VM、服务和业务。','state:str-resume':'表示从保留上下文的 STR 状态恢复设备、VM 和业务。','state:vm-recreate':'表示 Guest/VM 实例被销毁后重新创建，旧会话不可直接沿用。','state:process-restart':'表示单进程直接失效后的重启或拉起，影响范围小于 VM/Host 重启。','component:usb-connector':'承载 Type-C/USB 物理插拔、角色和电气连接。','component:usb-controller':'执行 xHCI/USB 枚举、端点和传输控制。','component:block-device':'把已枚举的存储设备呈现为块设备并报告读写错误。','component:filesystem-volume':'完成文件系统挂载、卷状态和用户可见存储访问。','interface:tee-transport':'在 Normal World 与 TEE 之间传递安全调用和响应。','component:tee-service':'在安全世界执行受保护服务与访问控制。','component:secure-storage':'保存 RPMB/SFS 等受保护数据并维护完整性。',
  'domain:assurance':'组织稳定性、恢复策略、验证与 TPM 闭环。','domain:performance':'组织 CPU、IO、内存、调度与帧链的性能诊断。','domain:diagnosis':'组织跨域时间线、异常包、观测和证据边界。','failure:app-crash':'表示应用或普通进程直接崩溃，需与后续重启和上游触发分开。','failure:system-server':'表示 system_server 直接失效并引发 Android Framework 级恢复。','failure:vm-reset':'表示 Guest/VM 级复位或重建，影响该 VM 内多项服务。','failure:host-reset':'表示 Host/SoC 级复位并导致更广泛的运行域重启。','process:db-ke-forensics':'按异常分类、寄存器、调用栈和符号版本固定步骤分析 DB/KE 包。','observation:first-fatal':'在统一时间线中定位最早致命事件，避免把清理和恢复当作根因。','observation:cpu-io-memory':'联合检查 CPU、iowait、内存压力、调度和限额。','observation:frame-chain':'沿输入、合成、提交、vblank 和呈现检查端到端帧时延。','component:log-producer':'产生运行日志并控制频率、级别和重复输出。','component:log-retention':'执行日志落盘、轮转、容量和断电留存。','failure:log-storm':'表示高频重复日志消耗 CPU/IO/空间并覆盖早期证据。','process:tpm-trigger':'明确用户现象、影响、版本、时间和首轮分析入口。','process:tpm-direct-failure':'用最早可证实断点界定直接失效环节与首轮责任域。','process:tpm-recovery':'区分临时恢复、异常处理和永久修复责任。','process:tpm-verification':'用触发场景、正常路径、异常恢复和相邻业务回归完成关闭。'
};
const relationWhys={
  'rel:hmi:006':'Camera Control 负责启停和配置 AVM 拼接流程，控制请求与视频帧数据必须分开验证。','rel:hmi:007':'Camera Frame Data 把多路视频帧送入 AVM 拼接，需以同一路 frame/sequence 证明真实交付。','rel:hmi:008':'四路帧计数用于确认 AVM 拼接的每一路输入是否持续，不能用单路正常代替四路正常。','rel:hmi:009':'Audio Playback 的 PCM 数据需要进入项目选定的 DSP 路径后才能继续送往输出链。','rel:hmi:010':'Audio Capture 需要把采集数据交给 AEC/Echo Reference 相关处理，供语音链使用。','rel:hmi:011':'AEC Reference 必须与实际 DSP 播放路径对应，否则回声参考与扬声器输出会失配。',
  'rel:conn:001':'以太网 PCS 的数字链路状态需要交给 PHY 形成介质侧连接，两层均正常才具备物理 Link 条件。','rel:conn:002':'PHY Link Up 只提供物理连接，仍需建立地址、路由与 L3 可达性。','rel:conn:003':'Wi-Fi STA 关联和链路建立后，仍需完成地址、路由与 L3 连通。','rel:conn:004':'SoftAP 为手机互联提供接入网络，但热点在线不等于互联会话和业务成功。','rel:conn:005':'Modem 接收到远端业务后触发 Remote Wake 流程，仍受电源策略和唤醒接口约束。','rel:conn:006':'Cold Boot 必须绑定新的 boot generation，防止把上一次运行周期的日志混入。','rel:conn:007':'STR Resume 需与原 suspend attempt 和当前 boot/VM generation 关联。','rel:conn:008':'VM Recreate 产生新的 VM generation，旧通道、订阅与会话需要重新建立。','rel:conn:009':'Process Restart 用 request ID 或进程实例关联恢复前后的业务请求，避免误判为连续处理。','rel:conn:010':'USB 连接器的物理插入和角色确定后，控制器才能开始枚举与传输。','rel:conn:011':'USB 控制器完成枚举后，存储设备还需成功呈现为块设备。','rel:conn:012':'块设备可读写后，文件系统仍需检查、挂载并形成可用卷。','rel:conn:013':'TEE Transport 把 Normal World 请求送入安全服务，调用成功需核对请求和响应。','rel:conn:014':'TEE Service 依赖 Secure Storage 保存受保护状态，服务在线不能替代 RPMB/SFS 访问结果。',
  'rel:assurance:001':'App/Process Crash 是直接失效，Process Restart 是其后的恢复动作；恢复成功不证明崩溃根因。','rel:assurance:002':'system_server 失效会触发 Framework 服务重建或进程重启，应把直接失效与恢复结果分开。','rel:assurance:003':'VM Reset 是 Guest 级直接失效，VM Recreate 是后续重建，影响范围跨多个 Guest 服务。','rel:assurance:004':'Host Reset 是 Host/SoC 级直接失效，Cold Boot 是下游恢复路径。','rel:assurance:005':'DB/KE 取证以 First Fatal 为时间线锚点，再分析寄存器、堆栈和符号。','rel:assurance:006':'CPU/IO/Memory 观测用于区分算力、存储和内存压力对性能的贡献。','rel:assurance:007':'Frame Chain 把输入、合成、提交与呈现串起来，用于定位卡顿的最早断点。','rel:assurance:008':'Log Producer 失控或重试循环会表现为 Log Storm，并可能放大 CPU/IO 压力。','rel:assurance:009':'Log Storm 的证据保留和影响程度取决于 Log Retention、轮转和容量策略。','rel:assurance:010':'TPM 从现象触发进入直接失效定位，先确定最早断点再讨论最终根因。','rel:assurance:011':'确认直接失效后，需要区分触发方、修复方和恢复策略方来组织措施。','rel:assurance:012':'恢复或修复措施只有经过触发、正常、异常恢复和相邻业务回归才能关闭。'
};

async function migrateRemaining(file){
  const pack=await read(file),localById=new Map(pack.entities.map(item=>[item.id,item]));
  for(const entity of pack.entities){
    if(entity.knowledge?.role)continue;
    const role=remainingRoles[entity.id];
    if(!role){entity.contentState='awaiting_absorption';delete entity.knowledge;continue;}
    delete entity.contentState;
    const incoming=pack.relations.filter(item=>item.to===entity.id).map(item=>localById.get(item.from)?.title||item.from);
    const outgoing=pack.relations.filter(item=>item.from===entity.id).map(item=>localById.get(item.to)?.title||item.to);
    entity.knowledge=knowledge(role,incoming.length?incoming.map(title=>`来自「${title}」的输入、状态或触发`):['所属链路的上游输入、状态或触发'],
      [entity.kind==='state'?'按运行周期和进入/退出条件维护状态':entity.kind==='observation'?'在统一时间基准和运行周期内解释观测':'执行本节点职责并保留输入、内部状态和输出'],
      outgoing.length?outgoing.map(title=>`交付给「${title}」的数据、控制或状态`):['本节点可验证的处理结果'],
      [`${entity.title} 的上游输入、内部状态、下游输出与同一运行周期日志`],['车型、版本、接口编号、器件方案和阈值以当前项目资料为准']);
  }
  const allById=new Map([...power.entities,...platform.entities,...pack.entities].map(item=>[item.id,item]));
  for(const relation of pack.relations){
    if(relation.why&&relation.verification?.length)continue;
    const from=allById.get(relation.from),to=allById.get(relation.to),why=relationWhys[relation.id];
    relation.why=why||`「${from?.title||relation.from}」向「${to?.title||relation.to}」交付本关系定义的数据、控制或状态。`;
    relation.input=`「${from?.title||relation.from}」产生的可验证输入或状态`;
    relation.handoff=`${from?.runtimeDomain||from?.domain||'上游'} 到 ${to?.runtimeDomain||to?.domain||'下游'} 的 ${relation.type} 边界`;
    relation.output=`「${to?.title||relation.to}」收到或形成的结果`;
    relation.verification=[`在两端用同一时间基准、运行周期和标识核对「${from?.title||relation.from}」与「${to?.title||relation.to}」`];
  }
  splitPlatformClaims(pack);
  await save(file,pack);return pack;
}
const hmi=await migrateRemaining('content/domain-packs/hmi-media.json');
const connectivity=await migrateRemaining('content/domain-packs/connectivity-lifecycle.json');
const assurance=await migrateRemaining('content/domain-packs/assurance.json');

console.log(`Pyramid migration: platform ${platform.entities.length}/${platform.relations.length}; power ${power.entities.length}/${power.relations.length}; remaining ${hmi.entities.length+connectivity.entities.length+assurance.entities.length}/${hmi.relations.length+connectivity.relations.length+assurance.relations.length}; taxonomy ${taxonomy.length}.`);
