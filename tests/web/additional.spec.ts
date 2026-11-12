import {test,expect} from './fixtures';
import {authenticator} from 'otplib';
test('admin MFA opens desktop navigation or phone drawer',async({page,isMobile})=>{
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('admin@agriprovider.test');
 await page.getByLabel('Password',{exact:true}).fill('Harvest!Demo2026');
 // Avoid submitting a TOTP that expires while the browser dispatches the login.
 if(authenticator.timeRemaining()<5)await new Promise(resolve=>setTimeout(resolve,(authenticator.timeRemaining()+1)*1000));
 await page.getByLabel('Authenticator or recovery code (if enabled)').fill(authenticator.generate('JBSWY3DPEHPK3PXP'));
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Administration',exact:true})).toBeVisible();
 if(isMobile)await page.getByRole('button',{name:'Open administration menu'}).click();
 await page.getByRole('button',{name:'Users',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Invite user',exact:true})).toBeVisible();
});
test('exported shell reloads offline with cached account data',async({page,context})=>{
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('provider@agriprovider.test');
 await page.getByLabel('Password',{exact:true}).fill('Harvest!Demo2026');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
 await context.setOffline(true);await page.reload();
 await expect(page.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();
 await expect(page.getByText('Something went wrong',{exact:true})).toHaveCount(0);
 await context.setOffline(false);
});

test('offline sign-out remains signed out after reconnect and reload',async({page,context})=>{
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('provider@agriprovider.test');
 await page.getByLabel('Password',{exact:true}).fill('Harvest!Demo2026');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();
 await context.setOffline(true);await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await context.setOffline(false);await page.reload();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 const reopened=await context.newPage();await reopened.goto('/');
 await expect(reopened.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await reopened.getByLabel('Email',{exact:true}).fill('provider@agriprovider.test');
 await reopened.getByLabel('Password',{exact:true}).fill('Harvest!Demo2026');
 await reopened.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(reopened.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();
 await reopened.reload();
 await expect(reopened.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();
 await reopened.close();
});

