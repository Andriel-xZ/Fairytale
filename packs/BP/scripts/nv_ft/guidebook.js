
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

world.afterEvents.playerSpawn.subscribe(xZ => {
    if (xZ.initialSpawn && !xZ.player.hasTag('nv_ft:first_guidebook')) {
        xZ.player.addTag('nv_ft:first_guidebook');
        xZ.player.dimension.spawnItem(new ItemStack('nv_ft:fairytale_guidebook'), xZ.player.location);
    };
});

world.beforeEvents.itemUse.subscribe(xZ => {
    if (xZ.itemStack?.typeId != 'nv_ft:fairytale_guidebook') return;
    system.run(() => guidebookFirstPage(xZ.source));
});

const guidebookButtons = [
]; 

function guidebookFirstPage(source) {
    const page = new ModalFormData();
    page.title('nv_ft.guidebook.first_page.title');
    page.divider()
    page.label('nv_ft.guidebook.first_page.text');
    page.divider()
    page.submitButton('Close');

    page.show(source).then(r => {
        if (r.canceled) return;
    });
};

function guidebookButtonPage(source, button) {
    const page = new ActionFormData();
    page.title(`nv_ft.guidebook.${button}.title`);
    page.body(`nv_ft.guidebook.${button}.text`);
    if (button == 'compatibility') page.button(`nv_ft.guidebook.clear_cache.button`, 'textures/vtng/fn/ui/guidebook_icons/bin');
    page.button(`nv_ft.guidebook.return`, 'textures/vtng/fn/ui/guidebook_icons/return');
    page.show(source).then(r => {
        if (r.canceled) return;
        if (button == 'compatibility') {
            if (r.selection == 0) {
                world.setDynamicProperty('nv_ft:custom_recipes', undefined);
                world.setDynamicProperty('nv_ft:without_recipes', undefined); 
                world.setDynamicProperty('nv_ft:recipe_tests', undefined); 
                source.playSound('note.bell');
                source.sendMessage({ translate: 'nv_ft.guidebook.clear_cache.text' });
            } else guidebookFirstPage(source);
        } else guidebookFirstPage(source);
    });
};