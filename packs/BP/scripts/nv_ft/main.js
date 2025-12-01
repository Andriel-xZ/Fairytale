import * as mc from "@minecraft/server";
import * as mcui from "@minecraft/server-ui";
import { breakTent, placeTent } from "./tent";
import "./guidebook";

mc.system.beforeEvents.startup.subscribe(data => {
    data.blockComponentRegistry.registerCustomComponent('nv_ft:tent_multiblock', {
        beforeOnPlayerPlace: xZ => { placeTent(xZ); },
        onPlayerBreak: xZ => { breakTent(xZ.block, xZ.dimension, xZ.brokenBlockPermutation); }
    });
    data.blockComponentRegistry.registerCustomComponent('nv_ft:on_place', {
        onPlace: ({block, dimension}) => { 
            if (!dimension.isChunkLoaded(block.location)) return;
            if (block.typeId == 'nv_ft:campfire') placeBlockWithEntity(block, dimension);
        },
    });
    data.blockComponentRegistry.registerCustomComponent('nv_ft:spawn_campsite', {
        onTick: ({block, dimension}) => {
            const generated = block.permutation.getState('nv_ft:generate');
            const blockRotation = block.permutation.getState('minecraft:cardinal_direction');

            if (!generated) {
                if (!dimension.isChunkLoaded(block.location)) return;
                block.setType('minecraft:air');
                const CardinalRotationMap = {
                    south: "None",
                    west: "Rotate90",
                    north: "Rotate180",
                    east: "Rotate270"
                };
                const structureList = [
                    'nv_ft:common_campsite',
                    'nv_ft:common_campsite_2',
                    'nv_ft:common_campsite_3',
                    'nv_ft:bandit_campsite_1',
                    'nv_ft:bandit_campsite_2',
                    'nv_ft:bandit_campsite_3',
                ];

                const index = Math.floor(Math.random() * structureList.length);
                const structure = structureList[index];

                mc.world.structureManager.place(structure, dimension, block.location, { rotation: CardinalRotationMap[blockRotation] });
            };
        }
    });
    data.blockComponentRegistry.registerCustomComponent('nv_ft:on_interact', {
        onPlayerInteract: ({block, dimension, player, face, faceLocation}) => { 
            if (block.typeId == 'nv_ft:campfire') {
                const burnStage = block.permutation.getState('nv_ft:burn_stage');
                const blockEntity = dimension.getEntities({ type: 'nv_ft:campfire_entity', location: block.center(), maxDistance: 0.25, closest: 1 })[0];
                
                const playerEquipment = player.getComponent('minecraft:equippable');
                const handItem = playerEquipment.getEquipment('Mainhand');

                if ((burnStage == 0 || burnStage == 2) && handItem?.typeId == 'minecraft:flint_and_steel') {
                    block.setPermutation(block.permutation.withState('nv_ft:burn_stage', 1));
                    blockEntity.setProperty('nv_ft:burn_stage', 1);
                    dimension.playSound('fire.ignite', block.center());
                    dimension.playSound('fire.fire', block.center());
                };

                if (burnStage == 1 && handItem?.typeId.includes('shovel')) {
                    block.setPermutation(block.permutation.withState('nv_ft:burn_stage', 2));
                    blockEntity.setProperty('nv_ft:burn_stage', 2);
                    dimension.playSound('dig.gravel', block.center(), { pitch: 1.5 });
                    dimension.playSound('fire.ignite', block.center(), { pitch: 1.5 });
                };
            };
        }
    });
});


function placeBlockWithEntity(block, dimension) {
    const blockRotation = block.permutation.getState('minecraft:cardinal_direction');
    const entityBlock = dimension.spawnEntity(block.typeId + '_entity', block.center());
    entityBlock.setProperty('nv_ft:cardinal_rotation', blockRotation);
    block.setPermutation(block.permutation.withState('nv_ft:placed', true));
};



mc.world.afterEvents.dataDrivenEntityTrigger.subscribe(async ({entity, eventId}) => {
    const nearbyPlayers =  entity.dimension.getPlayers({ maxDistance: 10, location: entity.location });
    if (eventId === 'nv_ft:grab') {
        const playerTarget = nearbyPlayers[0];
        if (!playerTarget) return;

        playerTarget.inputPermissions.setPermissionCategory(1, false);
        playerTarget.inputPermissions.setPermissionCategory(2, false);
        playerTarget.inputPermissions.setPermissionCategory(5, false);
        playerTarget.inputPermissions.setPermissionCategory(6, false);
        playerTarget.camera.fade({fadeColor: { blue: 0, green: 0, red: 0 }, fadeTime: { fadeInTime: 0.25, fadeOutTime: 0.5, holdTime: 1 }})
        await mc.system.waitTicks(5);

        const viewDirection = entity.getViewDirection();
        const cameraLocation = { 
            x: entity.location.x + viewDirection.x * 8, 
            y: entity.location.y + 10, 
            z: entity.location.z + viewDirection.z * 8 
        };
        playerTarget.camera.setCamera('minecraft:free', { location: cameraLocation, facingEntity: entity, easeOptions: { easeTime: 2, easeType: 'OutCirc' } });
        const entityRotation = entity.getRotation();
        playerTarget.teleport(entity.location, { rotation: entityRotation });
        playerTarget.playAnimation('animation.nv_ft.player.troll_grab_eat', { controller: 'tst', stopExpression: `t.troll_rotation = ${entityRotation.y}; return q.all_animations_finished;` });
    };

    if (eventId === 'nv_ft:reset_player_cam_and_move') {
        nearbyPlayers.forEach(player => {
            player.camera.clear();
            player.inputPermissions.setPermissionCategory(1, true);
            player.inputPermissions.setPermissionCategory(2, true);
            player.inputPermissions.setPermissionCategory(5, true);
            player.inputPermissions.setPermissionCategory(6, true);
        });
    };
}, { eventTypes: [ 'nv_ft:grab', 'nv_ft:reset_player_cam_and_move' ]});

const trollRumors = [
    {
        title: "An Ancient Whisper",
        text: "Have you heard the stories, traveler?\n\nThere's something that has awakened from its deep slumber. Something dangerous. Stay alert, and watch your surroundings as you explore!"
    },
    {
        title: "The Earth Groans",
        text: "The ground itself groans some nights... as if something under it is shifting."
    },
    {
        title: "The Forest Devours",
        text: "Folk say an entire grove of trees vanished overnight. Not chopped. Just... gone."
    },
    {
        title: "Older Than Villages",
        text: "Whatever woke up, it's older than any village you'll find around here."
    },
    {
        title: "Silence of the Wind",
        text: "If you feel the wind stop suddenly, don't stand still. Run!"
    },
    {
        title: "Wandering Shadows",
        text: "Strange shadows move at dusk lately. Too large to be wolves... too slow to be men."
    },
    {
        title: "The Awakened Guardian",
        text: "The stories tell of a creature as tall as a tree, and with hands as large as barrels.\n\nRumor has it that it still lays claim to the forest and considers anyone who dares to chop wood in it their enemy."
    },
    {
        title: "The Forest Bows",
        text: "Some say the forest itself bends to make way for it."
    },
    {
        title: "Moss-Covered Footsteps",
        text: "The trees remember its footsteps, and the moss grows thicker where it treads."
    },
    {
        title: "Silence of the Birds",
        text: "You can tell it's near when the birds fall silent... and then fly away all at once."
    },
    {
        title: "The Earthbone Crack",
        text: "If you hear a distant cracking sound, like bones of the earth breaking. Stay away!"
    },
    {
        title: "The Fallen Guardian",
        text: "They say the creature was once the forest's guardian... until something angered it."
    },
    {
        title: "Weak Eyes, Deadly Ears",
        text: "Don't be fooled. While the Troll may have poor eyesight, its smell and hearing remain sharp."
    },
    {
        title: "The Scent of Fear",
        text: "If you think you're hidden, you're not. It can smell fear a mile away."
    },
    {
        title: "The Betraying Twig",
        text: "Step on a twig, and you might as well shout your name out loud."
    },
    {
        title: "Listening to the Roots",
        text: "The beast can hear roots shifting underground. Imagine what it hears above."
    },
    {
        title: "The Final Sniff",
        text: "If it pauses and sniffs the air... It's already found you."
    }
];
mc.world.beforeEvents.playerInteractWithEntity.subscribe(data => {
    const { target: entity, player, itemStack } = data;

    if (entity.typeId === "nv_ft:villager_common") {
        mc.system.run(() => {
            const count = trollRumors.length;
            if (count === 0) return;

            const index = Math.floor(Math.random() * count);
            const rumor = trollRumors[index];

            const form = new mcui.ModalFormData()
                .title(rumor.title)
                .divider()
                .label(rumor.text)
                .divider()
                .submitButton('Close');
                
            form.show(player).catch(() => { /* ignora erros de UI */ });
        });
    };
});


mc.world.afterEvents.playerBreakBlock.subscribe(data => {
    if (data.brokenBlockPermutation.type.id.includes('log')) {
        if (!data.dimension.getBiome(data.block.location).id.includes('forest') || Math.random() < 0.98) return;

         // --- DIREÇÃO E POSIÇÃO 20 BLOCOS ATRÁS ---

        const dir = data.player.getViewDirection(); // { x, y, z }
        const distance = 20;

        // posição atrás do jogador (mantendo Y do jogador)
        const behindPos = {
            x: data.player.location.x - dir.x * distance,
            y: data.player.location.y,              // ou player.location.y - dir.y * distance se quiser 3D mesmo
            z: data.player.location.z - dir.z * distance
        };

        // se for usar como posição de bloco, arredonda:
        const trollSpawnPos = data.dimension.getTopmostBlock({ x: behindPos.x, z: behindPos.z }).location;
        data.dimension.spawnEntity('nv_ft:troll', trollSpawnPos);
    };
})