import { test,expect } from './fixtures';
async function signIn(page:any,email='provider@agriprovider.test'){
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Harvest!Demo2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
test('provider signs in, sees real data, and cannot open admin routes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await signIn(page);await expect(page.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();
 await page.getByRole('button',{name:'Register learner →'}).click();await expect(page.getByText('Nomsa Nkosi',{exact:true})).toBeVisible();
 await page.getByLabel('Full name',{exact:true}).fill('Test Learner');await page.getByLabel('ID number',{exact:true}).fill('abc123');await page.getByLabel('Phone number',{exact:true}).fill('+27821234567');await page.getByRole('checkbox',{name:'I confirm the learner has consented to the collection of their information.'}).click();await page.getByRole('button',{name:'Register learner',exact:true}).click();await expect(page.getByText('Enter exactly 13 digits without letters, spaces or dashes.')).toBeVisible();
 await page.goto('/(admin)/dashboard');await expect(page.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/provider-'+test.info().project.name+'.png',fullPage:true});
});
test('assessor receives a separate workspace',async({page})=>{await signIn(page,'assessor@agriprovider.test');await expect(page.getByRole('heading',{name:'Assessor Portal'})).toBeVisible();await expect(page.getByRole('button',{name:'Register learner →'})).toHaveCount(0);});
test('QA receives its own audit queue',async({page})=>{await signIn(page,'qa@agriprovider.test');await expect(page.getByRole('heading',{name:'QA Workspace'})).toBeVisible();await page.getByRole('button',{name:'Review audit →'}).first().click();await expect(page.getByRole('button',{name:'Unlock Milestone',exact:true})).toBeDisabled();});
test('forgot password returns the same response for unknown accounts',async({page})=>{await page.goto('/forgot-password');await page.getByLabel('Email',{exact:true}).fill('unknown@example.test');await page.getByRole('button',{name:'Send reset link'}).click();await expect(page.getByText('If an eligible account exists, a password reset link will be sent.')).toBeVisible();});
test('offline attendance remains in the account queue and syncs on reconnect',async({page,context})=>{
 await signIn(page);await page.getByRole('button',{name:'Take attendance →'}).click();await expect(page.getByText('Nomsa Nkosi',{exact:true})).toBeVisible();await page.getByRole('button',{name:'✓ Present',exact:true}).first().click();await page.getByRole('checkbox',{name:'Mark all remaining unmarked learners absent'}).click();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
 await context.setOffline(true);await page.getByRole('button',{name:'Save & sync later',exact:true}).click();await expect(page.getByText('Saved on this device. Check the Sync tab for delivery status.')).toBeVisible();
 await page.getByRole('tab',{name:/Sync/}).click();await expect(page.getByText('Attendance · Maize Production',{exact:true})).toBeVisible();await context.setOffline(false);await page.getByRole('button',{name:'Sync all now'}).click();await expect(page.getByText('Everything is up to date.')).toBeVisible({timeout:30000});
});