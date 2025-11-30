import { system, world, ItemStack, BlockTypes, ItemTypes, EquipmentSlot } from "@minecraft/server";

const debugMode = false;

// -=-=-=--=-=-=-=-=-=-=-=-=-=-=-=- FINALIZADOS -=-=-=--=-=-=-=-=-=-=-=-=-=-=-=- 

export function isSolid(block) {
    let blockId = block.typeId;
    if (block.isAir || (!block.typeId.includes('minecraft:') && !block.typeId.includes('rc_fb:'))) return false;
    const nonSolidBlocks = new Set([
        "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy", "sunflower", "lilac",
        "rose_bush", "peony", "cornflower", "lily_of_the_valley", "tall_grass", "short_grass", "fern", "large_fern", "deadbush", "seagrass", "air", "waterlily", "vine", "ladder", "rail",
        "golden_rail", "activator_rail", "tripwire_hook", "beacon", "web", "snow_layer", "iron_bars", "chain", "scaffolding", "bamboo", "sea_pickle", "conduit",
        "lightning_rod", "sweet_berry_bush", "small_dripleaf_block", "big_dripleaf", "flower_pot", "amethyst_cluster", "budding_amethyst", "pointed_dripstone", 
        "glow_lichen",  "spore_blossom", "hanging_roots", "end_rod", "bell", "lantern", "soul_lantern", "chain", "soul_fire", "bubble_column", "redstone_wire"
    ]);
    const nonSolidGroups = [
        "wall", "stair", "slab", "glass", "carpet", "leaves", "vines", "coral", "torch", "mushroom", "sign", "banner", "frame", "portal", "campfire",
        "fence", "chest"
    ];
    if (nonSolidGroups.some(word => blockId.includes(word)) || nonSolidBlocks.has(blockId.replace('minecraft:', ''))) return false;
    else return true;
};

export function getRedstonePower(block) {
    const blockRedstonePower = block.getRedstonePower();
    if (!blockRedstonePower) {
        for (let face of ['north', 'south', 'east', 'west', 'below']) {
            const newBlock = block[face]();
            const newBlockRedstonePower = newBlock?.getRedstonePower();
            const avoidBlocks = ['redstone_wire', 'repeater', 'comparator', 'redstone_torch'];
            if ((newBlockRedstonePower > 0 && !avoidBlocks.some(block => newBlock?.typeId.includes(block))) ||
                (newBlock?.typeId.includes('redstone_torch') && newBlock?.permutation.getState('torch_facing_direction') != invertFace[face])) {
                return newBlockRedstonePower;
            };
        };
        const aboveBlock = block.above(); const aboveBlockPower = aboveBlock?.getRedstonePower();
        if ((aboveBlock?.typeId == 'minecraft:daylight_detector' || aboveBlock?.typeId == 'minecraft:redstone_block') && aboveBlockPower > 0) return aboveBlockPower;
    };
    return blockRedstonePower;
};

export function damageDurability(player, itemStack, damageAmount = 1, slot = 'Mainhand') {
    const itemDurability = itemStack.getComponent('minecraft:durability'); if (!itemDurability) return;
    const playerInv = player.getComponent('minecraft:inventory').container;
    const playerEquipment = player.getComponent('minecraft:equippable');
    let itemSlot;

    // Verifica se o item está no slot indicado
    if (typeof slot !== 'string' && playerInv.getItem(slot)?.typeId === itemStack?.typeId) itemSlot = playerInv.getSlot(slot);
    else if (typeof slot === 'string' && playerEquipment.getEquipment(slot)?.typeId === itemStack?.typeId) itemSlot = playerEquipment.getEquipmentSlot(slot);
    else {
        for (let i = 0; i < playerInv.size; i++) {
            const invItem = playerInv.getItem(i);
            if (invItem?.typeId === itemStack?.typeId) {
                itemSlot = playerInv.getSlot(i);
                break;
            };
        };
    };
    if (!itemSlot?.isValid || damageAmount <= 0) return true;

    let effectiveDamage = 0; // Dano efetivo a ser aplicado

    // Obtém nível de encantamento Unbreaking
    let unbreakingLevel = 0;
    const enchantable = itemStack.getComponent('minecraft:enchantable');
    if (enchantable) {
        const unbreaking = enchantable.getEnchantment('unbreaking');
        if (unbreaking?.level) unbreakingLevel = unbreaking.level;
    };

    // Calcula dano efetivo considerando o encantamento Unbreaking
    if (unbreakingLevel > 0) {
        const consumeChance = 1 / (unbreakingLevel + 1);
        for (let i = 0; i < damageAmount; i++) {
            if (Math.random() < consumeChance) {
                effectiveDamage++;
            };
        };
    } else effectiveDamage = damageAmount;

    // Retorna se não houver dano efetivo
    if (effectiveDamage <= 0) return true;

    // Aplica dano ao item
    const itemDamage = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const totalDamage = itemDamage + effectiveDamage;

    if (totalDamage > maxDurability) {
        itemSlot.setItem(undefined);
        player?.playSound('random.break');
        return;
    };

    itemDurability.damage = totalDamage;
    itemSlot.setItem(itemStack);
    return true;
};

export function replaceItem(player, searchId, replaceId, damageAmount = 0, lockMode = 'none', keepOnDeath = false) {
    const playerInv = player.getComponent('minecraft:inventory').container;
    const playerEquipment = player.getComponent('minecraft:equippable');
    const mainhandItem = playerEquipment.getEquipment('Mainhand');
    const offhandItem = playerEquipment.getEquipment('Offhand');
    let searchedItem, replaceSlot;

    // Search for the item to be replaced
    if (mainhandItem?.typeId == searchId) { searchedItem = mainhandItem; replaceSlot = 'Mainhand'; }
    else if (offhandItem?.typeId == searchId) { searchedItem = offhandItem; replaceSlot = 'Offhand'; }
    else {
        for (let slot = 0; slot < playerInv.size; slot++) {
            const invItem = playerInv.getItem(slot);
            if (invItem?.typeId == searchId) {
                searchedItem = invItem;
                replaceSlot = slot;
                break;
            };
        };
    };    

    if (!searchedItem || replaceSlot == undefined) return false;
    const applyDamage = damageDurability(player, searchedItem, damageAmount, replaceSlot);
    if (!applyDamage) return false;

    // Extracting item properties to preserve them
    const searchedItemData = {
        amount: searchedItem.amount,
        durability: searchedItem.getComponent('minecraft:durability'),
        enchantments: searchedItem.getComponent('minecraft:enchantable')?.getEnchantments() || [],
        lore: searchedItem.getLore() || [],
        nameTag: searchedItem?.nameTag || '',
        dynamicPropertyIds: searchedItem.getDynamicPropertyIds() || []
    };

    // Creating the replacement item with the preserved properties
    let replacementItem = new ItemStack(replaceId, searchedItemData.amount);
   
    if (false) {
        replacementItem = undefined;
        player.playSound('random.break');
    } else {
        replacementItem.getComponents().forEach(component => {
            if (component.typeId === 'minecraft:durability') component.damage = searchedItemData.durability.damage;
            if (component.typeId === 'minecraft:enchantable') component.addEnchantments(searchedItemData.enchantments);
        });
        replacementItem.setLore(searchedItemData.lore);
        replacementItem.nameTag = searchedItemData.nameTag || '';
        searchedItemData.dynamicPropertyIds.forEach(propertyId => {
            replacementItem.setDynamicProperty(propertyId, searchedItem.getDynamicProperty(propertyId));
        });
        replacementItem.lockMode = lockMode;
        replacementItem.keepOnDeath = keepOnDeath;
    };

    // Replacing the item in the player's inventory or equipment
    if (replaceSlot === 'Mainhand' || replaceSlot === 'Offhand') {
        playerEquipment.setEquipment(replaceSlot, replacementItem);
    } else {
        playerInv.setItem(replaceSlot, replacementItem);
    };

    return replacementItem !== undefined;
};

/**
 * @param player - Jogador onde será feita a busca.
 * @param searchId - Um typeId ou uma array de typeIds aceitos.
 * @param firstSlot - Slot inicial a ser checado (equipamento ou slot do inventário).
 * @param searchEquipment - Se true, também varre todos os slots de equipamento (Armaduras e Segunda mão).
 */
export function searchItem(player, searchId, firstSlot = 'Mainhand', searchEquipment) {
    const playerInv = player.getComponent('minecraft:inventory').container;
    const playerEquipment = player.getComponent('minecraft:equippable');

    const checkId = (typeId) => {
        if (!typeId) return false;
        if (typeof searchId === 'string') return typeId === searchId;
        return searchId.includes(typeId); // searchId é array de string
    };

    if (typeof firstSlot === 'string') {
        const searchItemBySlot = playerEquipment.getEquipment(firstSlot);
        if (checkId(searchItemBySlot?.typeId)) return { item: searchItemBySlot, slot: playerEquipment.getEquipmentSlot(firstSlot) };
    } else {
        const searchItemBySlot = playerInv.getItem(firstSlot);
        if (checkId(searchItemBySlot?.typeId)) return { item: searchItemBySlot, slot: playerInv.getSlot(firstSlot) };
    };
    
    if (searchEquipment) {
        for (const slotName of Object.values(EquipmentSlot)) {
            if (slotName === firstSlot) continue;
            const equipItem = playerEquipment.getEquipment(slotName);
            if (checkId(equipItem?.typeId)) return { item: equipItem, slot: playerEquipment.getEquipmentSlot(slotName) };
        };
    };

    for (let i = 0; i < playerInv.size; i++) {
        const invItem = playerInv.getItem(i);
        if (checkId(invItem?.typeId)) return { item: invItem, slot: playerInv.getSlot(i) };
    };
};

export const replaceableBlocks = new Set([
  "minecraft:air", "minecraft:cave_air", "minecraft:void_air",
  "minecraft:water", "minecraft:flowing_water",
  "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:tall_grass", "minecraft:short_grass",
  "minecraft:tall_dry_grass", "minecraft:short_dry_grass",
  "minecraft:large_fern", "minecraft:fern",
  "minecraft:seagrass", "minecraft:vine",
  "minecraft:glow_lichen", "minecraft:deadbush",
  "minecraft:leaf_litter", "minecraft:bush",
  "minecraft:waterlily", "minecraft:snow_layer",
]);

export const indestructibleBlocks = new Set([
  "minecraft:bedrock", "minecraft:end_portal", "minecraft:end_portal_frame",
  "minecraft:barrier", "minecraft:portal", "minecraft:command_block",
  "minecraft:chain_command_block", "minecraft:repeating_command_block",
  "minecraft:structure_block", "minecraft:jigsaw", "minecraft:structure_void",
  "minecraft:deny", "minecraft:allow", "minecraft:border_block"
]);

export const invertFace = { 
    'north': 'south', 'south': 'north', 
    'east': 'west', 'west': 'east', 
    'up': 'down', 'down': 'up', 
    'above': 'below', 'below': 'above',
    
    'above.north': 'below.south', 'below.north': 'above.south',
    'above.south': 'below.north', 'below.south': 'above.north',
    'above.east': 'below.west', 'below.east': 'above.west',
    'above.west': 'below.east', 'below.west': 'above.east',

    'east.north': 'west.south', 'west.north': 'east.south',
    'east.south': 'west.north', 'west.south': 'east.north',
    'above.east': 'below.west', 'below.east': 'above.west',
    'above.west': 'below.east', 'below.west': 'above.east'
};

export const correctDirections = {
    'north': {
        north: 'north', south: 'south', east: 'east', west: 'west', above: 'above', below: 'below',
        aboveEast: 'above.east', aboveWest: 'above.west', belowEast: 'below.east', belowWest: 'below.west',

        aboveNorth: 'above.north', belowNorth: 'below.north', aboveSouth: 'above.south', belowSouth: 'below.south',
        eastNorth: 'east.north', eastSouth: 'east.south', westNorth: 'west.north', westSouth: 'west.south'
    },
    'south': { 
        north: 'south', south: 'north', east: 'west', west: 'east', above: 'above', below: 'below',
        aboveEast: 'above.west', aboveWest: 'above.east', belowEast: 'below.west', belowWest: 'below.east',

        aboveNorth: 'above.south', belowNorth: 'below.south', aboveSouth: 'above.north', belowSouth: 'below.north',
        eastNorth: 'west.south', eastSouth: 'west.north', westNorth: 'east.south', westSouth: 'east.north'
    },
    'east': { 
        north: 'east', south: 'west', east: 'south', west: 'north', above: 'above', below: 'below',
        aboveEast: 'above.south', aboveWest: 'above.north', belowEast: 'below.south', belowWest: 'below.north',

        aboveNorth: 'above.east', belowNorth: 'below.east', aboveSouth: 'above.west', belowSouth: 'below.west',
        eastNorth: 'east.south', eastSouth: 'west.south', westNorth: 'east.north', westSouth: 'west.north'
    },
    'west': { 
        north: 'west', south: 'east', east: 'north', west: 'south', above: 'above', below: 'below',
        aboveEast: 'above.north', aboveWest: 'above.south', belowEast: 'below.north', belowWest: 'below.south',
    
        aboveNorth: 'above.west', belowNorth: 'below.west', aboveSouth: 'above.east', belowSouth: 'below.east',
        eastNorth: 'west.north', eastSouth: 'east.north', westNorth: 'west.south', westSouth: 'east.south'
    },
    'up': { 
        north: 'above', south: 'below', east: 'east', west: 'west', above: 'south', below: 'north',
        aboveEast: 'east.south', aboveWest: 'west.south', belowEast: 'east.north', belowWest: 'west.north',

        aboveNorth: 'above.south', belowNorth: 'above.north', aboveSouth: 'below.south', belowSouth: 'below.north',
        eastNorth: 'above.east', eastSouth: 'below.east', westNorth: 'above.west', westSouth: 'below.west'
    },
    'down': { 
        north: 'below', south: 'above', east: 'east', west: 'west', above: 'north', below: 'south',
        aboveEast: 'east.north', aboveWest: 'west.north', belowEast: 'east.south', belowWest: 'west.south',

        aboveNorth: 'below.north', belowNorth: 'below.south', aboveSouth: 'above.north', belowSouth: 'above.south',
        eastNorth: 'below.east', eastSouth: 'above.east', westNorth: 'below.west', westSouth: 'above.west'
    }
};

export const rotationToFace = { 
    'north': 'north', 'south': 'south', 
    'east': 'east', 'west': 'west', 
    'up': 'above', 'down': 'below'
};

export function isBlock(typeId) {
    return BlockTypes.get(typeId);
};

export function getSegment(initialValue, currentValue, parts) {
    const segmentSize = initialValue / parts;
    return Math.min(parts, Math.ceil(currentValue / segmentSize));
};

export function getFacingDirection(player, block) {
    const { x: pitch, y: rawYaw } = player.getRotation();
    const yaw = (rawYaw + 360) % 360;
    const dy = block ? block.y - player.location.y : 0;

    // Se houver bloco e está em altura diferente, considera up/down
    if (block && Math.abs(dy) > 1) {
        if (pitch <= -43) return "up";
        if (pitch >= 43) return "down";
    } else if (!block) {
        if (pitch <= -43) return "up";
        if (pitch >= 43) return "down";
    };
    
    if (yaw < 45 || yaw >= 315) return "south";
    if (yaw < 135) return "west";
    if (yaw < 225) return "north";
    return "east";
};

export function getCardinalDirection(entity) {
    const yaw = (entity.getRotation().y % 360 + 360) % 360;
    if (yaw >= 45 && yaw < 135) return "west";
    if (yaw >= 135 && yaw < 225) return "north";
    if (yaw >= 225 && yaw < 315) return "east";
    return "south";
};


export function correctFaceLoc(location, faceLocation, face) {
  const offset = {
    x: face === 'East' ? 1 : faceLocation.x,
    y: face === 'Up' && faceLocation.y === 0 ? 1 : faceLocation.y,
    z: face === 'South' ? 1 : faceLocation.z
  };
  return Object.fromEntries(Object.entries(location).map(([axis, value]) => [axis, value + offset[axis]]));
};


export function locationFromRotation(rotation, location) {
    const yaw = ((rotation.y + 180) / 180) * Math.PI;
    const rotatedX = location.x * Math.cos(yaw) - location.z * Math.sin(yaw);
    const rotatedZ = location.x * Math.sin(yaw) + location.z * Math.cos(yaw);
    return { x: rotatedX, y: location?.y ?? 0, z: rotatedZ };
};

export class vector {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    };

    static sum(vetorA, vetorB) {
        return new vector(
            (vetorA.x || 0) + (vetorB.x || 0),
            (vetorA.y || 0) + (vetorB.y || 0),
            (vetorA.z || 0) + (vetorB.z || 0)
        );
    };

    static multiply(vetor, num) {
        return new vector(
            (vetor.x || 0) * num,
            (vetor.y || 0) * num,
            (vetor.z || 0) * num
        );
    };

    static multiplyVector(vetorA, vetorB) {
        return new vector(
            (vetorA.x || 0) * (vetorB.x || 0),
            (vetorA.y || 0) * (vetorB.y || 0),
            (vetorA.z || 0) * (vetorB.z || 0)
        );
    };

    static distance(vetorA, vetorB) {
        if (!vetorA || !vetorB) return undefined;
        const dx = (vetorA.x || 0) - (vetorB.x || 0);
        const dy = (vetorA.y || 0) - (vetorB.y || 0);
        const dz = (vetorA.z || 0) - (vetorB.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    static direction(vetorA, vetorB) {
        const direction = {
            x: vetorB.x - vetorA.x,
            y: vetorB.y - vetorA.y,
            z: vetorB.z - vetorA.z
        };
        const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
        if (magnitude === 0) return { x: 0, y: 0, z: 0 }; // Pontos idênticos

        return { x: direction.x / magnitude, y: direction.y / magnitude, z: direction.z / magnitude };
    };

    static directionToDegrees(vetor) {
        const yaw = Math.atan2(-vetor.x, -vetor.z) * (180 / Math.PI);
        const pitch = Math.atan2(vetor.y, Math.sqrt(vetor.x ** 2 + vetor.z ** 2)) * (180 / Math.PI);
        return { yaw, pitch };
    };

    static subtract(vetorA, vetorB) {
        if (!vetorA || !vetorB) return undefined;
        return new vector(
            (vetorA.x || 0) - (vetorB.x || 0),
            (vetorA.y || 0) - (vetorB.y || 0),
            (vetorA.z || 0) - (vetorB.z || 0)
        );
    };

    static compare(a, b) {
        return a.x === b.x && a.y === b.y && a.z === b.z;
    };

    static normalize(vetor) {
        const m = Math.hypot(vetor.x, vetor.y, vetor.z) || 1;
        return { x: vetor.x / m, y: vetor.y / m, z: vetor.z / m };
    };

    static createCircle(startblock, radius, numBlocks) {
        if (!startblock || !radius || !numBlocks) return [];
        const softness = (2 * Math.PI) / numBlocks;
        const blockLocations = [];
        const startBlockCenter = startblock.center();
        for (let i = 0; i < numBlocks; i++) {
            const x = startBlockCenter.x + radius * Math.cos(i * softness);
            const z = startBlockCenter.z + radius * Math.sin(i * softness);
            const y = startBlockCenter.y;
            blockLocations.push(new vector(x, y, z));
        };
        return blockLocations;
    };
};



export function volumeDebug(pivot, size, dimension, particleId) {
    const corners = [
        { x: pivot.x, y: pivot.y, z: pivot.z },
        { x: pivot.x + (size.x + 1), y: pivot.y, z: pivot.z },
        { x: pivot.x, y: pivot.y + (size.y + 1), z: pivot.z },
        { x: pivot.x, y: pivot.y, z: pivot.z + (size.z + 1) },
        { x: pivot.x + (size.x + 1), y: pivot.y + (size.y + 1), z: pivot.z },
        { x: pivot.x + (size.x + 1), y: pivot.y, z: pivot.z + (size.z + 1) },
        { x: pivot.x, y: pivot.y + (size.y + 1), z: pivot.z + (size.z + 1) },
        { x: pivot.x + (size.x + 1), y: pivot.y + (size.y + 1), z: pivot.z + (size.z + 1) }
    ];

    for (const cornerPos of corners) {
        if (system.currentTick % 20 === 0) dimension.spawnParticle(particleId || 'minecraft:villager_happy', cornerPos);
    };
};



const interval = 1;
let TPS = 20;
let lastDate = Date.now();
if (debugMode) {
    system.runInterval(() => {
        const currDate = Date.now();
        TPS = interval * 50 / (currDate - lastDate) * 20;
        lastDate = currDate;
        const player = world.getAllPlayers()[0];
        player?.onScreenDisplay.setActionBar(`TPS: §e${TPS.toFixed(2)}`);
    }, interval);
};


// -=-=-=--=-=-=-=-=-=-=-=-=-=-=-=- EM PROGRESSO -=-=-=--=-=-=-=-=-=-=-=-=-=-=-=- 



export function removeItem(player, searchId, amount) {
    const playerInv = player.getComponent('minecraft:inventory').container;
    for (let slot = 0; slot < playerInv.size; slot++) {
        const itemSearched = playerInv.getItem(slot);
        if (itemSearched?.typeId == searchId) {
            if (itemSearched.amount < amount) return;
            const replacementItem = new ItemStack(itemSearched?.typeId, itemSearched.amount > amount ?  itemSearched.amount-amount : 1);
            if (amount) playerInv.setItem(slot, itemSearched.amount > amount ? replacementItem : undefined);
            return true;
        };
    };
};




