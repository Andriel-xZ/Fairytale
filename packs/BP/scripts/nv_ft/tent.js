import * as mc from "@minecraft/server"
import { invertFace, replaceableBlocks } from "./xZ-Utils";



// mc.world.afterEvents.playerInventoryItemChange.subscribe(({ player, itemStack, slot }) => {
//     if (!itemStack || !itemStack.typeId.includes('__')) return;

//     const blockId = itemStack.typeId.split('__')[0];
//     if (!multiBlockConfig[blockId]) return;

//     const playerInv = player.getComponent('minecraft:inventory')?.container;
//     playerInv.setItem(slot, new mc.ItemStack(blockId, playerInv.getItem(slot)?.amount || 1));
// }, { ignoreQuantityChange: true });

export const multiBlockConfig = {
    'nv_ft:boiler_chamber': { 
        rotationState: 'minecraft:cardinal_direction',
        size: { x: 2, y: 3, z: 2 },
        anchor: { x: 0, y: 0, z: 0 },
        partLetters: { x: 'lr', y: 'bmt', z: 'fb' }
    },
    'nv_ft:pressurization_chamber': { 
        rotationState: 'minecraft:cardinal_direction',
        size: { x: 2, y: 3, z: 2 },
        anchor: { x: 0, y: 0, z: 0 },
        partLetters: { x: 'lr', y: 'bmt', z: 'fb' }
    },
    'nv_ft:fluid_tank': { 
        rotationState: 'minecraft:cardinal_direction',
        size: { x: 3, y: 2, z: 2 },
        anchor: { x: 1, y: 0, z: 0 },
        partLetters: { x: 'lmr', y: 'bt', z: 'fb' }
    },
};


/** @param {mc.BlockComponentPlayerPlaceBeforeEvent} data */
export function placeTent(data) {
    const { block, player, dimension, permutationToPlace } = data;
    const blockRotation = permutationToPlace.getState('minecraft:cardinal_direction');
    const base = block.location;
    const size = { x: 5, y: 4, z: 5 };
    const anchor = { x: 2, y: 0, z: 0 };

    if (!canPlaceVolume(dimension, base, blockRotation, size, anchor)) {
        mc.system.run(() => player.playSound('note.bass', { volume: 0.25, pitch: 1.35 }));
        data.cancel = true;
        return;
    };

    mc.system.run(() => {
        const coordRotation = rotXZ[blockRotation];
        block.setPermutation(mc.BlockPermutation.resolve(permutationToPlace.type.id, { "minecraft:cardinal_direction": blockRotation, "nv_ft:placed": true, "nv_ft:is_main": true, "nv_ft:collision_type": "frontPillar", "nv_ft:lx": 2 }));
        const tentEntity = dimension.spawnEntity(permutationToPlace.type.id + '_entity', block.center());
        tentEntity.setProperty('nv_ft:cardinal_rotation', blockRotation);

        // Preenche o volume
        for (let ly = 0; ly < size.y; ly++) {
            for (let lz = 0; lz < size.z; lz++) {
                for (let lx = 0; lx < size.x; lx++) {
                    // Pular esses blocos (vazio interno) e as quinas e arestas do topo
                    if (lx >= 1 && lx <= 3 && ly >= 0 && ly <= 2 && lz >= 1 && lz <= 3) continue;
                    const isCornerX = (lx === 0 || lx === 4); const isCornerZ = (lz === 0 || lz === 4);
                    const isEdgeX = (lx === 0 || lx === 4); const isEdgeZ = (lz === 0 || lz === 4); const isTop = (ly === 3);
                    if ((isTop && (isEdgeX || isEdgeZ)) || (isCornerX && isCornerZ)) continue;

                    // Offset local relativo ao principal: principal é (0,0,0)
                    const ox = lx - anchor.x;
                    const oy = ly - anchor.y;
                    const oz = lz - anchor.z;

                    if (ox === -1 && oy >= 0 && oy <= 2 && oz === 0) continue; // porta frontal
                    if (ox === 0 && oy === 0 && oz === 0) continue; // pilar frontal principal (já colocado)

                    // Converte do espaço local para o mundo aplicando rotação cardinal no plano XZ
                    const { x: rx, z: rz } = coordRotation({ x: -ox, z: oz });
                    const pos = { x: base.x + rx, y: base.y + oy, z: base.z + rz };

                    let collisionType = 'frontWall';
                    if (isTop) collisionType = 'top';
                    else if (ox === -2) collisionType = 'leftWall';
                    else if (ox === 2) collisionType = 'rightWall';
                    else if (oz === 4) collisionType = 'backWall';
                    else if (oz === 0) collisionType = 'frontWall';
                    if (ox === 0 && oz === 0) collisionType = 'frontPillar';

                    const permutations = {
                        "minecraft:cardinal_direction": blockRotation,
                        "nv_ft:placed": true,
                        "nv_ft:collision_type": collisionType,
                        "nv_ft:lx": lx,
                        "nv_ft:ly": ly,
                        "nv_ft:lz": lz
                    };
                    dimension.setBlockPermutation(pos, mc.BlockPermutation.resolve(permutationToPlace.type.id, permutations));
                };
            };
        };
    });
};


/** @param {mc.Block} block @param {mc.dimension} dimension @param {mc.BlockPermutation} brokenBlockPermutation */
export function breakTent(block, dimension, brokenBlockPermutation) {
    if (!brokenBlockPermutation.type.id.startsWith('nv_ft:tent')) return;

    const size = { x: 5, y: 4, z: 5 };
    const anchor = { x: 2, y: 0, z: 0 };

    const blockRotation = brokenBlockPermutation.getState('minecraft:cardinal_direction');
    const rot = rotXZ[blockRotation];

    let lx, ly, lz;
    try {
        lx = brokenBlockPermutation.getState('nv_ft:lx');
        ly = brokenBlockPermutation.getState('nv_ft:ly');
        lz = brokenBlockPermutation.getState('nv_ft:lz');
    } catch (e) {
        // se por algum motivo não tiver states, não faz nada
        return;
    }

    const ox = lx - anchor.x;
    const oy = ly - anchor.y;
    const oz = lz - anchor.z;

    // Mesma transformação do placeTent, só que invertendo pra achar a base:
    // world = base + rot({ x: -ox, z: oz }), y = base.y + oy
    // => base = world - rot({ x: -ox, z: oz })
    const { x: rx, z: rz } = rot({ x: -ox, z: oz });
    const base = {
        x: block.x - rx,
        y: block.y - oy,
        z: block.z - rz
    };


    // Varrer o volume inteiro e quebrar qualquer bloco nv_ft:tent
    for (let ly2 = 0; ly2 < size.y; ly2++) {
        for (let lz2 = 0; lz2 < size.z; lz2++) {
            for (let lx2 = 0; lx2 < size.x; lx2++) {

                const ox2 = lx2 - anchor.x;
                const oy2 = ly2 - anchor.y;
                const oz2 = lz2 - anchor.z;

                const { x: rxx, z: rzz } = rot({ x: -ox2, z: oz2 });
                const pos = {
                    x: base.x + rxx,
                    y: base.y + oy2,
                    z: base.z + rzz
                };

                const b = dimension.getBlock(pos);
                if (!b) continue;
                if (b.typeId !== brokenBlockPermutation.type.id) continue;

                dimension.runCommand(`setblock ${pos.x} ${pos.y} ${pos.z} air destroy`);
            }
        }
    }
}

export function canPlaceVolume(dimension, basePos, facing, size, anchor) {
    const rot = rotXZ[facing];

    for (let ly = 0; ly < size.y; ly++) {
        for (let lz = 0; lz < size.z; lz++) {
            for (let lx = 0; lx < size.x; lx++) {
                // Ignora o cubo 3x3x3 no centro (índices 1,2,3 em cada eixo)
                if (lx >= 1 && lx <= 3 && ly >= 0 && ly <= 2 && lz >= 1 && lz <= 3) continue;

                // Ignora as 4 quinas verticais inteiras (todas as alturas Y)
                const isCornerX = (lx === 0 || lx === 4);
                const isCornerZ = (lz === 0 || lz === 4);
                if (isCornerX && isCornerZ) continue;

                // Ignora as 4 arestas horizontais do topo (Y=3)
                const isEdgeX = (lx === 0 || lx === 4);
                const isEdgeZ = (lz === 0 || lz === 4);
                const isTop = (ly === 3);
                if (isTop && (isEdgeX || isEdgeZ)) continue;

                // offset local relativo ao principal (principal é 0,0,0)
                const ox = lx - (anchor?.x ?? 0);
                const oy = ly - (anchor?.y ?? 0);
                const oz = lz - (anchor?.z ?? 0);

                // mesma rotação usada na colocação (XZ), Y direto
                const { x: rx, z: rz } = rot({ x: -ox, z: oz });
                const pos = { x: basePos.x + rx, y: basePos.y + oy, z: basePos.z + rz };

                const b = dimension.getBlock(pos);
                if (!replaceableBlocks.has(b?.typeId)) return false;
            };
        };
    };
    return true;
};


const rotXZ = {
    south: ({ x, z }) => ({ x, z }),          // default
    west:  ({ x, z }) => ({ x: -z, z:  x }),  // +90°
    north: ({ x, z }) => ({ x: -x, z: -z }),  // 180°
    east:  ({ x, z }) => ({ x:  z, z: -x }),  // -90°
};