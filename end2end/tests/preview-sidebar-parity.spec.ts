import {test,expect} from '@playwright/test';
import es from '../../app/src/i18n/es.json';

test('preview inspector displays compact sections and translated parameter controls',async({page})=>{
 await page.setViewportSize({width:1440,height:940});
 await page.goto('/');await page.waitForFunction(()=>(window as any).reportstudioReady);
 await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('es');
 await page.getByRole('button',{name:es['Preview'],exact:true}).click();
 const panel=page.locator('.preview-options-panel');await expect(panel).toHaveCSS('width','292px');
 await expect(panel.locator('summary')).toHaveText([es['Report parameters'],es['View options']]);
 const fields=panel.locator('.preview-parameter-field');await expect(fields).toHaveCount(4);
 const dates=panel.locator('input[type=date]');await expect(dates).toHaveCount(2);
 await expect(panel.getByRole('combobox',{name:es['Customer'],exact:true})).toHaveValue('');
 await expect(panel.getByRole('combobox',{name:es['Status'],exact:true})).toHaveValue('');
 await expect(panel.getByRole('option',{name:es['All'],exact:true})).toHaveCount(2);
 for(const control of await panel.locator('.preview-parameter-field input,.preview-parameter-field select').all()) expect((await control.boundingBox())!.height).toBe(36);
 for(let i=1;i<4;i++){
  const before=(await fields.nth(i-1).boundingBox())!,after=(await fields.nth(i).boundingBox())!;
  expect(after.y-before.y-before.height).toBeCloseTo(16,0);
 }
 await expect(panel.getByRole('checkbox')).toHaveCount(3);
 for(const check of await panel.getByRole('checkbox').all()){expect((await check.boundingBox())!.width).toBe(16);await expect(check).toHaveCSS('border-radius','1px');}
 await expect(panel.locator('.preview-panel-information dt')).toHaveText([es['Pages:'],es['Size:'],es['Orientation:'],es['Records:']]);
 await expect(panel.locator('.preview-panel-information dd').last()).toHaveText('3');
 await panel.screenshot({path:test.info().outputPath('reportstudio-preview-sidebar-'+test.info().project.name+'.png')});
 const params=panel.locator('details').first();await params.locator('summary').click();await expect(dates.first()).toBeHidden();await params.locator('summary').click();await expect(dates.first()).toBeVisible();
 const fit=panel.getByRole('checkbox',{name:es['Fit to width'],exact:true});await fit.check();await expect(fit).toBeChecked();
 const zoom=await page.getByRole('spinbutton',{name:'Preview zoom',exact:true}).inputValue();
 await page.setViewportSize({width:1640,height:940});
 await expect(page.getByRole('spinbutton',{name:'Preview zoom',exact:true})).not.toHaveValue(zoom);
 await page.getByRole('combobox',{name:'Preview fit',exact:true}).selectOption('actual');await expect(fit).not.toBeChecked();
 const customer=panel.getByRole('combobox',{name:es['Customer'],exact:true});const options=await customer.locator('option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value).filter(Boolean));expect(options.length).toBeGreaterThan(0);
 await customer.selectOption(options[0]);await panel.getByRole('button',{name:es['Refresh preview'],exact:true}).click();
 await expect(panel.locator('.preview-panel-information dd').last()).toHaveText('3');
});
