import {test,expect} from './fixtures';
import {authenticator} from 'otplib';
import QRCode from 'qrcode';
async function login(page:any,email:string,password='Harvest!Demo2026',admin=false){
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
 if(admin){if(authenticator.timeRemaining()<5)await new Promise(r=>setTimeout(r,(authenticator.timeRemaining()+1)*1000));await page.getByLabel('Authenticator or recovery code (if enabled)').fill(authenticator.generate('JBSWY3DPEHPK3PXP'));}
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
test('staff signup remains pending until an administrator approves it',async({page})=>{
 test.setTimeout(90000);
 const email='review-'+Date.now()+'@example.test',password='Bountiful!Rain2026';
 await page.goto('/signup');await page.getByRole('button',{name:'Assessor',exact:true}).click();
 await page.getByLabel('Full name',{exact:true}).fill('Browser Reviewer');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Organisation',{exact:true}).fill('Browser Test Organisation');
 await page.getByLabel('Province',{exact:true}).selectOption('Gauteng');await page.getByLabel('Phone number',{exact:true}).fill('+27821234567');
 await page.getByLabel('Password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);
 await page.getByRole('checkbox').click();await page.getByRole('button',{name:'Request account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Awaiting Administrator Approval',exact:true})).toBeVisible();
 await login(page,email,password);await expect(page.getByRole('heading',{name:'Awaiting Administrator Approval',exact:true})).toBeVisible();
 await login(page,'admin@agriprovider.test',undefined,true);await expect(page.getByRole('heading',{name:'Administration',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Review pending accounts/}).click();
 const card=page.getByText(email,{exact:true}).locator('..');
 await card.getByRole('checkbox').click();await card.getByRole('button',{name:'Approve account',exact:true}).click();
 await expect(page.getByText(email,{exact:true})).toHaveCount(0);
 const menu=page.getByRole('button',{name:'Open administration menu',exact:true});
 if(await menu.isVisible())await menu.click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await login(page,email,password);await expect(page.getByRole('heading',{name:'Assessor Portal',exact:true})).toBeVisible();await expect(page.getByText('No cohorts assigned yet.',{exact:true})).toBeVisible();
});
test('learner has private courses, lessons, attendance and results with role redirects',async({page})=>{
 await login(page,'learner@agriprovider.test');await expect(page.getByRole('heading',{name:'My Courses',exact:true})).toBeVisible();
 await expect(page.getByText('Lerato Dube',{exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Lessons',exact:true}).click();await expect(page.getByRole('heading',{name:'Upcoming lessons',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Attendance',exact:true}).click();await expect(page.getByRole('heading',{name:'My attendance',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Results',exact:true}).click();await expect(page.getByRole('heading',{name:'My results & certificates',exact:true})).toBeVisible();
 for(const route of ['/(admin)/dashboard','/(provider)/home','/(assessor)/home','/(qa)/audits']){await page.goto(route);await expect(page.getByRole('heading',{name:'My Courses',exact:true})).toBeVisible();}
 await page.screenshot({path:'test-results/learner-'+test.info().project.name+'.png',fullPage:true});
});
test('MFA setup renders a scannable QR and recovery step before entering the app',async({page})=>{
 // Server challenge issuance/replay is tested against the real API; this checks rendering and UI state.
 const secret='JBSWY3DPEHPK3PXP',uri=authenticator.keyuri('setup@example.test','AgriProvider',secret),qrDataUrl=await QRCode.toDataURL(uri);
 await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{mfaSetupRequired:true,setupToken:'test-challenge',secret,qrDataUrl}}));
 await page.route('**/api/v1/auth/mfa/complete',route=>route.fulfill({json:{recoveryCodes:['one-time-code'],user:{role:'ADMIN'}}}));
 await login(page,'setup@example.test');await expect(page.getByRole('heading',{name:'Protect your account',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'Authenticator setup QR code'})).toBeVisible();
 await page.screenshot({path:'test-results/mfa-setup-'+test.info().project.name+'.png',fullPage:true});
 await page.getByLabel('Authenticator code',{exact:true}).fill(authenticator.generate(secret));await page.getByRole('button',{name:'Verify authenticator',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Save your recovery codes',exact:true})).toBeVisible();await expect(page.getByText('one-time-code',{exact:true})).toBeVisible();
});
