import * as mc from "@minecraft/server";
import { breakTent, placeTent } from "./tent";

mc.system.beforeEvents.startup.subscribe(data => {
    data.blockComponentRegistry.registerCustomComponent('nv_ft:tent_multiblock', {
        beforeOnPlayerPlace: xZ => { placeTent(xZ); },
        onPlayerBreak: xZ => { breakTent(xZ.block, xZ.dimension, xZ.brokenBlockPermutation); }
    });
    data.blockComponentRegistry.registerCustomComponent('nv_ft:block_with_entity', {
        onPlace: xZ => { placeBlockWithEntity(xZ.block, xZ.dimension); }
    });
});


function placeBlockWithEntity(block, dimension) {
    const blockRotation = block.permutation.getState('minecraft:cardinal_direction');
    const entityBlock = dimension.spawnEntity(block.typeId + '_entity', block.center());
    entityBlock.setProperty('nv_ft:cardinal_rotation', blockRotation);
    block.setPermutation(block.permutation.withState('nv_ft:placed', true));
};