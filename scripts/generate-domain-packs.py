import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
register=json.loads((ROOT/'content/source-register.json').read_text(encoding='utf-8'))
docs=register['documents']
by_category={}
for d in docs: by_category.setdefault(d['category'],[]).append(d)
preferred={
 'power':'b3ab2e67d52d','platform':'adec16da0d62','virtualization':'ccd5b795d5d9','android':'45653c777bca',
 'yocto':'872b38c6d67f','mcu':'183254d73cbd','display':'753ab8dd0db2','camera':'28f33b5b442f',
 'audio':'38c540b592d3','tbox':'f24f4fe4d19c','usb':'f89d9f4cd89b','security':'c94a6f788bd3',
 'stability':'0d324bedb45f','diagnosis':'2131e9dacedf','boot':None
}
evidence_page={'power':5,'platform':4,'virtualization':6,'android':6,'yocto':7,'mcu':6,'display':16,'camera':8,'audio':24,'tbox':2,'usb':15,'security':3,'stability':7,'diagnosis':6,'boot':4}

def source(category):
    pid=preferred.get(category)
    return next((d for d in by_category[category] if d['id']==pid),by_category[category][0])

def E(i,title,kind,domain,platforms=('MT8676',),description='',aliases=(),runtimeDomain=None):
    return {'id':i,'title':title,'kind':kind,'domain':domain,'platforms':list(platforms),'description':description or title,
            'aliases':list(aliases),'runtimeDomain':runtimeDomain or domain}

def make_pack(name,entities,rels):
    evidence=[]; claims=[]; relations=[]
    for idx,r in enumerate(rels,1):
        rid=f'rel:{name}:{idx:03d}'; category=r.pop('category'); source_id=r.pop('sourceId',None); pages=r.pop('pages',None); additional=r.pop('additionalEvidence',[])
        src=next((d for d in docs if d['id']==source_id),source(category))
        rel={'id':rid,'scope':'platform_scoped','status':'documented_reference',**r}
        if set(rel.get('platforms',[]))=={'MT8668','MT8676'}: rel['scope']='shared'
        relations.append(rel)
        evid=f'ev:{name}:{idx:03d}'
        src_platforms=[src['platform']] if src.get('platform') in {'MT8668','MT8676'} else []
        evidence.append({'id':evid,'sourceId':src['id'],'pages':pages or [evidence_page.get(category,1)],'status':rel.get('status','documented_reference'),'platforms':src_platforms,
          'summary':f"核对《{src['name']}》对应章节后，将“{ALL_ENTITY_TITLES.get(rel['from'],rel['from'])}”与“{ALL_ENTITY_TITLES.get(rel['to'],rel['to'])}”整理为资料参考关系；具体接线、编号和时序仍按对应版本复核。"})
        evidence_ids=[evid]
        evidence_platforms={evid:set(src_platforms)}
        for extra_idx,extra in enumerate(additional,1):
          extra_src=next(d for d in docs if d['id']==extra['sourceId']); extra_id=f'{evid}:{extra_idx}'; evidence_ids.append(extra_id)
          extra_platforms=[extra_src['platform']] if extra_src.get('platform') in {'MT8668','MT8676'} else []
          evidence_platforms[extra_id]=set(extra_platforms)
          evidence.append({'id':extra_id,'sourceId':extra_src['id'],'pages':extra['pages'],'status':rel.get('status','documented_reference'),'platforms':extra_platforms,
            'summary':f"《{extra_src['name']}》作为另一版本依据，与同一关系的其他版本并列保留，差异项在实车版本确认前不合并为当前事实。"})
        claim_id=f'claim:{name}:{idx:03d}'; relation_platforms=rel.get('platforms',[]); relation_status=rel.get('status','documented_reference')
        if relation_status=='documented_reference':
          covered=set().union(*evidence_platforms.values()) if evidence_platforms else set()
          documented=[platform for platform in relation_platforms if platform in covered]
          missing=[platform for platform in relation_platforms if platform not in covered]
          if documented:
            documented_evidence=[eid for eid in evidence_ids if evidence_platforms[eid]&set(documented)]
            claims.append({'id':claim_id,'relationId':rid,'evidenceIds':documented_evidence,
              'status':'documented_reference','platforms':documented})
          if missing:
            claims.append({'id':f'{claim_id}:inferred','relationId':rid,'evidenceIds':evidence_ids,
              'status':'inferred_mapping','platforms':missing})
          if not relation_platforms:
            claims.append({'id':claim_id,'relationId':rid,'evidenceIds':evidence_ids,
              'status':'inferred_mapping','platforms':[]})
        else:
          claims.append({'id':claim_id,'relationId':rid,'evidenceIds':evidence_ids,
            'status':relation_status,'platforms':relation_platforms})
    return {'entities':entities,'relations':relations,'claims':claims,'evidence':evidence}

power_entities=[
 E('domain:power','电源与生命周期','domain','power',('MT8668','MT8676'),'座舱供电、低功耗、休眠和唤醒主域。'),
 E('platform:mt8668','MT8668','platform','platform',('MT8668',)),E('platform:mt8676','MT8676','platform','platform',('MT8676',)),
 E('component:vehicle-power-input','车辆电源输入','component','power',('MT8668','MT8676')),E('component:mcu-power-manager','MCU PowerManager','component','mcu',('MT8668','MT8676')),
 E('interface:gpio-wake','GPIO / Wake IRQ','interface','power',('MT8668','MT8676')),E('interface:spi-ipcl','SPI / IPCL','interface','cross-domain',('MT8668','MT8676')),
 E('component:yocto-sleep-manager','Yocto SleepManager','component','yocto'),E('component:hypervisor-barrier','Hypervisor Suspend Barrier','component','virtualization'),
 E('component:hypervisor-suspend-v11','Hypervisor Suspend V1.1','component','virtualization'),E('component:hypervisor-suspend-v13','Hypervisor Suspend V1.3','component','virtualization'),
 E('component:android-guest','Android Guest','component','android',('MT8668','MT8676')),E('component:tbox-guest','TBox Guest','component','tbox'),
 E('process:kernel-suspend','Kernel Suspend','process','power'),E('component:atf','ATF','component','power'),E('component:spm','SPM','component','power'),
 E('component:pmic','PMIC / VCORE / DRAM','component','power'),E('component:mt6363','MT6363 Buck / LDO','component','power'),
 E('state:power-active','Active','state','power'),E('state:power-suspend-entry','Suspend Entry','state','power'),E('state:power-suspended','Suspended','state','power'),E('state:power-resume','Resume','state','power'),
 E('observation:wake-source','Wake Source','observation','diagnosis'),E('observation:framework-wake','framework_wake','observation','diagnosis'),
 E('observation:suspend-abort','suspend_abort','observation','diagnosis'),E('observation:wake-after-suspend','wake_after_suspend','observation','diagnosis'),
 E('component:backup-power','Backup Power','component','power')]
power_rels=[
 {'from':'component:vehicle-power-input','to':'component:mcu-power-manager','type':'controls','pathClass':'control','platforms':['MT8668','MT8676'],'category':'mcu'},
 {'from':'component:mcu-power-manager','to':'interface:gpio-wake','type':'controls','pathClass':'control','platforms':['MT8668','MT8676'],'category':'mcu'},
 {'from':'component:mcu-power-manager','to':'interface:spi-ipcl','type':'sends_to','pathClass':'control','platforms':['MT8668','MT8676'],'category':'mcu'},
 {'from':'interface:spi-ipcl','to':'component:yocto-sleep-manager','type':'sends_to','pathClass':'control','platforms':['MT8676'],'category':'yocto'},
 {'from':'component:yocto-sleep-manager','to':'component:hypervisor-barrier','type':'controls','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'component:hypervisor-barrier','to':'component:android-guest','type':'controls','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'component:hypervisor-barrier','to':'component:tbox-guest','type':'controls','pathClass':'control','platforms':['MT8676'],'category':'tbox'},
 {'from':'component:hypervisor-barrier','to':'process:kernel-suspend','type':'controls','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'component:hypervisor-suspend-v11','to':'component:hypervisor-suspend-v13','type':'conflicts_with','pathClass':'control','platforms':['MT8676'],'category':'power','status':'conflicting','sourceId':'e8cfe763d374','pages':[6],'additionalEvidence':[{'sourceId':'bd4864cd0a67','pages':[6]}]},
 {'from':'process:kernel-suspend','to':'component:atf','type':'sends_to','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'component:atf','to':'component:spm','type':'controls','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'component:spm','to':'component:pmic','type':'controls','pathClass':'power','platforms':['MT8676'],'category':'power'},
 {'from':'component:pmic','to':'component:mt6363','type':'powers','pathClass':'power','platforms':['MT8676'],'category':'power','sourceId':'232daa16ff71','pages':[[7,8]]},
 {'from':'component:backup-power','to':'component:pmic','type':'powers','pathClass':'power','platforms':['MT8676'],'category':'power','sourceId':'232daa16ff71','pages':[16]},
 {'from':'state:power-active','to':'state:power-suspend-entry','type':'transitions_to','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'state:power-suspend-entry','to':'state:power-suspended','type':'transitions_to','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'state:power-suspended','to':'state:power-resume','type':'transitions_to','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'state:power-resume','to':'state:power-active','type':'transitions_to','pathClass':'control','platforms':['MT8676'],'category':'power'},
 {'from':'process:kernel-suspend','to':'observation:wake-source','type':'observed_by','pathClass':'diagnostic','platforms':['MT8676'],'category':'power','sourceId':'b3ab2e67d52d','pages':[8]},
 {'from':'state:power-active','to':'observation:framework-wake','type':'observed_by','pathClass':'diagnostic','platforms':['MT8676'],'category':'power','sourceId':'b3ab2e67d52d','pages':[7]},
 {'from':'state:power-suspend-entry','to':'observation:suspend-abort','type':'observed_by','pathClass':'diagnostic','platforms':['MT8676'],'category':'power','sourceId':'b3ab2e67d52d','pages':[14]},
 {'from':'state:power-suspended','to':'observation:wake-after-suspend','type':'observed_by','pathClass':'diagnostic','platforms':['MT8676'],'category':'power','sourceId':'b3ab2e67d52d','pages':[15]}]

platform_entities=[
 E('domain:platform','整机与平台','domain','platform',('MT8668','MT8676')),E('domain:virtualization','虚拟化','domain','virtualization',('MT8668','MT8676')),
 E('domain:android','Android AAOS','domain','android',('MT8668','MT8676')),E('domain:yocto','Yocto Host','domain','yocto',('MT8668','MT8676')),E('domain:mcu','MCU 与车信号','domain','mcu',('MT8668','MT8676')),E('domain:cross-domain','跨域通信','domain','cross-domain',('MT8668','MT8676')),
 E('component:hypervisor','Hypervisor','component','virtualization',('MT8668','MT8676')),E('component:yocto-host','Yocto Host','component','yocto',('MT8668','MT8676')),E('component:mcu','MCU','component','mcu',('MT8668','MT8676')),E('component:tbox','TBox','component','tbox',('MT8668','MT8676')),
 E('interface:binder','Binder','interface','android',('MT8668','MT8676')),E('interface:fdbus','FDBus','interface','cross-domain',('MT8668','MT8676')),E('interface:someip','SOME/IP','interface','cross-domain',('MT8668','MT8676')),E('interface:vsock','Vsock','interface','virtualization',('MT8668','MT8676')),E('interface:virtio','virtio','interface','virtualization',('MT8668','MT8676')),
 E('observation:sequence','Sequence ID','observation','diagnosis',('MT8668','MT8676')),E('observation:freshness','Freshness / Timestamp','observation','diagnosis',('MT8668','MT8676')),E('observation:boot-generation','Boot / VM Generation','observation','diagnosis',('MT8668','MT8676')),E('observation:request-id','Request ID','observation','diagnosis',('MT8668','MT8676'))]
platform_rels=[
 {'from':'component:hypervisor','to':'component:yocto-host','type':'controls','pathClass':'control','platforms':['MT8668','MT8676'],'category':'virtualization'},
 {'from':'platform:mt8676','to':'platform:mt8668','type':'variant_of','pathClass':'control','platforms':['MT8668','MT8676'],'scope':'shared','status':'inferred_mapping','category':'virtualization','sourceId':'ccd5b795d5d9','pages':[6],'additionalEvidence':[{'sourceId':'adec16da0d62','pages':[6]}]},
 {'from':'component:android-guest','to':'component:hypervisor','type':'runs_on','pathClass':'control','platforms':['MT8668','MT8676'],'category':'virtualization'},
 {'from':'component:yocto-host','to':'interface:fdbus','type':'publishes','pathClass':'data','platforms':['MT8668','MT8676'],'category':'yocto'},
 {'from':'component:android-guest','to':'interface:binder','type':'publishes','pathClass':'data','platforms':['MT8668','MT8676'],'category':'android'},
 {'from':'component:tbox','to':'interface:someip','type':'publishes','pathClass':'data','platforms':['MT8668','MT8676'],'category':'tbox'},
 {'from':'component:android-guest','to':'interface:vsock','type':'sends_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'virtualization'},
 {'from':'component:android-guest','to':'interface:virtio','type':'depends_on','pathClass':'data','platforms':['MT8668','MT8676'],'category':'virtualization'},
 {'from':'component:mcu','to':'interface:spi-ipcl','type':'publishes','pathClass':'control','platforms':['MT8668','MT8676'],'category':'mcu'},
 {'from':'interface:fdbus','to':'observation:sequence','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'interface:someip','to':'observation:freshness','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'component:hypervisor','to':'observation:boot-generation','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'virtualization'},
 {'from':'interface:vsock','to':'observation:request-id','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'virtualization'}]

hmi_entities=[
 E('domain:hmi','HMI','domain','hmi',('MT8668','MT8676')),E('domain:display','显示与触控','domain','display',('MT8668','MT8676')),E('domain:camera','Camera / AVM','domain','camera',('MT8668','MT8676')),E('domain:audio','音频与语音','domain','audio',('MT8668','MT8676')),
 E('component:android-display','Android HWC / SurfaceFlinger','component','display',('MT8668','MT8676')),E('component:yocto-display','Yocto DRM / Weston','component','display',('MT8668','MT8676')),E('component:physical-display','物理屏 / SerDes','component','display',('MT8668','MT8676')),E('component:backlight','背光','component','display',('MT8668','MT8676')),E('interface:input-event','Input Event','interface','display',('MT8668','MT8676')),E('observation:first-frame','首帧 submit / present','observation','diagnosis',('MT8668','MT8676')),
 E('component:camera-control','Camera Control','component','camera',('MT8668','MT8676')),E('interface:camera-frame','Camera Frame Data','interface','camera',('MT8668','MT8676')),E('component:avm-stitch','AVM 四路拼接','component','camera',('MT8668','MT8676')),E('observation:camera-four-stream','四路帧计数','observation','diagnosis',('MT8668','MT8676')),
 E('process:audio-playback','Audio Playback','process','audio',('MT8668','MT8676')),E('process:audio-capture','Audio Capture','process','audio',('MT8668','MT8676')),E('component:aec-reference','AEC / Echo Reference','component','audio',('MT8668','MT8676')),E('component:dsp-variant','ADSP / External DSP Variant','component','audio',('MT8668','MT8676'))]
hmi_rels=[
 {'from':'component:android-display','to':'component:yocto-display','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'display'},
 {'from':'component:yocto-display','to':'component:physical-display','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'display'},
 {'from':'component:mcu','to':'component:backlight','type':'controls','pathClass':'control','platforms':['MT8668','MT8676'],'category':'display'},
 {'from':'interface:input-event','to':'component:android-guest','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'display'},
 {'from':'component:android-display','to':'observation:first-frame','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'display'},
 {'from':'component:camera-control','to':'component:avm-stitch','type':'controls','pathClass':'control','platforms':['MT8668','MT8676'],'category':'camera'},
 {'from':'interface:camera-frame','to':'component:avm-stitch','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'camera'},
 {'from':'component:avm-stitch','to':'observation:camera-four-stream','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'camera'},
 {'from':'process:audio-playback','to':'component:dsp-variant','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'audio'},
 {'from':'process:audio-capture','to':'component:aec-reference','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'audio'},
 {'from':'component:aec-reference','to':'component:dsp-variant','type':'depends_on','pathClass':'data','platforms':['MT8668','MT8676'],'category':'audio'}]

conn_entities=[
 E('domain:tbox','TBox 与连接','domain','tbox',('MT8668','MT8676')),E('domain:connectivity','有线与无线连接','domain','connectivity',('MT8668','MT8676')),E('domain:lifecycle','启动与生命周期','domain','lifecycle',('MT8668','MT8676')),E('domain:usb-storage','USB 与存储','domain','usb',('MT8668','MT8676')),E('domain:security','安全与 TEE','domain','security',('MT8668','MT8676')),
 E('component:ethernet-pcs','SGMII / PCS','component','connectivity',('MT8668','MT8676')),E('component:ethernet-phy','Ethernet PHY / Carrier','component','connectivity',('MT8668','MT8676')),E('process:l3-connectivity','L3 / IP Reachability','process','connectivity',('MT8668','MT8676')),E('component:wifi-sta','Wi-Fi STA','component','connectivity',('MT8668','MT8676')),E('component:wifi-softap','Wi-Fi SoftAP','component','connectivity',('MT8668','MT8676')),E('process:phone-link','手机互联会话','process','connectivity',('MT8668','MT8676')),E('component:modem','Modem / TSP','component','tbox',('MT8668','MT8676')),E('process:remote-wake','Remote Wake','process','tbox',('MT8668','MT8676')),
 E('state:cold-boot','Cold Boot','state','lifecycle',('MT8668','MT8676')),E('state:str-resume','STR Resume','state','lifecycle',('MT8668','MT8676')),E('state:vm-recreate','VM Recreate','state','lifecycle',('MT8668','MT8676')),E('state:process-restart','Process Restart','state','lifecycle',('MT8668','MT8676')),
 E('component:usb-connector','USB Connector / Type-C','component','usb',('MT8668','MT8676')),E('component:usb-controller','xHCI / USB Controller','component','usb',('MT8668','MT8676')),E('component:block-device','Block Device','component','usb',('MT8668','MT8676')),E('component:filesystem-volume','Filesystem / Volume','component','usb',('MT8668','MT8676')),
 E('interface:tee-transport','TEE Transport','interface','security',('MT8668','MT8676')),E('component:tee-service','TEE Service','component','security',('MT8668','MT8676')),E('component:secure-storage','RPMB / Secure Storage','component','security',('MT8668','MT8676'))]
conn_rels=[
 {'from':'component:ethernet-pcs','to':'component:ethernet-phy','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'platform'},
 {'from':'component:ethernet-phy','to':'process:l3-connectivity','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'platform'},
 {'from':'component:wifi-sta','to':'process:l3-connectivity','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'tbox'},
 {'from':'component:wifi-softap','to':'process:phone-link','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'tbox'},
 {'from':'component:modem','to':'process:remote-wake','type':'controls','pathClass':'control','platforms':['MT8668','MT8676'],'category':'tbox'},
 {'from':'state:cold-boot','to':'observation:boot-generation','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'boot'},
 {'from':'state:str-resume','to':'observation:boot-generation','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'boot'},
 {'from':'state:vm-recreate','to':'observation:boot-generation','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'virtualization'},
 {'from':'state:process-restart','to':'observation:request-id','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'component:usb-connector','to':'component:usb-controller','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'usb'},
 {'from':'component:usb-controller','to':'component:block-device','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'usb'},
 {'from':'component:block-device','to':'component:filesystem-volume','type':'carries_data_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'usb'},
 {'from':'interface:tee-transport','to':'component:tee-service','type':'sends_to','pathClass':'data','platforms':['MT8668','MT8676'],'category':'security'},
 {'from':'component:tee-service','to':'component:secure-storage','type':'depends_on','pathClass':'data','platforms':['MT8668','MT8676'],'category':'security'}]

assurance_entities=[
 E('domain:assurance','稳定性与质量保障','domain','assurance',('MT8668','MT8676')),E('domain:performance','性能与卡顿','domain','performance',('MT8668','MT8676')),E('domain:diagnosis','诊断与证据','domain','diagnosis',('MT8668','MT8676')),
 E('failure:app-crash','App / Process Crash','failure_mode','assurance',('MT8668','MT8676')),E('failure:system-server','system_server Restart','failure_mode','assurance',('MT8668','MT8676')),E('failure:vm-reset','Guest / VM Reset','failure_mode','assurance',('MT8668','MT8676')),E('failure:host-reset','Host / SoC Reset','failure_mode','assurance',('MT8668','MT8676')),
 E('process:db-ke-forensics','DB / KE 八步取证','process','diagnosis',('MT8668','MT8676')),E('observation:first-fatal','最早可信致命证据','observation','diagnosis',('MT8668','MT8676')),E('observation:cpu-io-memory','CPU / IO / Memory','observation','performance',('MT8668','MT8676')),E('observation:frame-chain','帧端到端链路','observation','performance',('MT8668','MT8676')),
 E('component:log-producer','Log Producer / Caller','component','diagnosis',('MT8668','MT8676')),E('component:log-retention','Log Retention / Rotation','component','diagnosis',('MT8668','MT8676')),E('failure:log-storm','Log Storm Amplification','failure_mode','diagnosis',('MT8668','MT8676')),
 E('process:tpm-trigger','TPM 触发与首轮牵头','process','assurance',('MT8668','MT8676')),E('process:tpm-direct-failure','直接失效与责任边界','process','assurance',('MT8668','MT8676')),E('process:tpm-recovery','恢复与修复','process','assurance',('MT8668','MT8676')),E('process:tpm-verification','验证与关闭','process','assurance',('MT8668','MT8676'))]
assurance_rels=[
 {'from':'failure:app-crash','to':'state:process-restart','type':'fails_as','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'stability'},
 {'from':'failure:system-server','to':'state:process-restart','type':'fails_as','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'stability'},
 {'from':'failure:vm-reset','to':'state:vm-recreate','type':'fails_as','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'stability'},
 {'from':'failure:host-reset','to':'state:cold-boot','type':'fails_as','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'stability'},
 {'from':'process:db-ke-forensics','to':'observation:first-fatal','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'stability'},
 {'from':'domain:performance','to':'observation:cpu-io-memory','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'stability'},
 {'from':'domain:performance','to':'observation:frame-chain','type':'observed_by','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'component:log-producer','to':'failure:log-storm','type':'fails_as','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'failure:log-storm','to':'component:log-retention','type':'depends_on','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'process:tpm-trigger','to':'process:tpm-direct-failure','type':'transitions_to','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'process:tpm-direct-failure','to':'process:tpm-recovery','type':'transitions_to','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'},
 {'from':'process:tpm-recovery','to':'process:tpm-verification','type':'transitions_to','pathClass':'diagnostic','platforms':['MT8668','MT8676'],'category':'diagnosis'}]

ALL_ENTITY_TITLES={x['id']:x['title'] for group in (power_entities,platform_entities,hmi_entities,conn_entities,assurance_entities) for x in group}
packs={'power':make_pack('power',power_entities,power_rels),'platform-runtime':make_pack('runtime',platform_entities,platform_rels),
       'hmi-media':make_pack('hmi',hmi_entities,hmi_rels),'connectivity-lifecycle':make_pack('conn',conn_entities,conn_rels),
       'assurance':make_pack('assurance',assurance_entities,assurance_rels)}
out=ROOT/'content/domain-packs'; out.mkdir(parents=True,exist_ok=True)
for name,data in packs.items(): (out/f'{name}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print({k:(len(v['entities']),len(v['relations'])) for k,v in packs.items()})
