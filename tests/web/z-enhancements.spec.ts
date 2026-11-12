import {test,expect} from './fixtures';
async function login(page:any,name:string){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(name+'@agriprovider.test');await page.getByLabel('Password',{exact:true}).fill('Harvest!Demo2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();}
test('learner uploads retain both files and provider opens their individual pack',async({page})=>{
 await login(page,'learner');await expect(page.getByRole('heading',{name:'My Courses',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Documents',exact:true}).click();
 const suffix=Date.now(),names=['ID-first-'+suffix+'.pdf','ID-second-'+suffix+'.pdf'];
 for(const name of names){const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload document',exact:true}).click();await(await choosing).setFiles({name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic ID document')});await expect(page.getByRole('button',{name:'Open '+name,exact:true})).toBeVisible({timeout:20000});}
 await expect(page.getByRole('button',{name:'Open '+names[0],exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/learner-documents-'+test.info().project.name+'.png',fullPage:true});
 // Expo retains the previous tab header; the active Documents header is the last one.
 await page.getByRole('button',{name:'Sign out',exact:true}).last().click();await login(page,'provider');
 await page.getByRole('tab',{name:'Learners',exact:true}).click();await page.getByRole('button',{name:'Evidence pack for Nomsa Nkosi',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open '+names[0],exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Open '+names[1],exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Submit this learner to assessor',exact:true})).toBeVisible();
});
test('signup selects country-specific provinces and rejects a mismatched phone',async({page})=>{
 await page.goto('/signup');await page.getByRole('button',{name:'Assessor',exact:true}).click();
 await page.getByLabel('Full name',{exact:true}).fill('Location Applicant');await page.getByLabel('Email',{exact:true}).fill('location-'+Date.now()+'@example.test');await page.getByLabel('Organisation',{exact:true}).fill('Local School');
 await page.getByLabel('Province',{exact:true}).selectOption('OTHER');await page.getByLabel('Country',{exact:true}).selectOption('US');await page.getByLabel('Province / State',{exact:true}).selectOption('California');await page.getByLabel('Phone number',{exact:true}).fill('+27821234567');
 await page.getByLabel('Password',{exact:true}).fill('Harvest!Rain2027');await page.getByLabel('Confirm password',{exact:true}).fill('Harvest!Rain2027');await page.getByRole('checkbox').click();await page.getByRole('button',{name:'Request account',exact:true}).click();
 await expect(page.getByText('Enter a valid phone number for your selected country.',{exact:true})).toBeVisible();await page.getByLabel('Phone number',{exact:true}).fill('+14155552671');await page.getByRole('button',{name:'Request account',exact:true}).click();await expect(page.getByRole('heading',{name:'Awaiting Administrator Approval',exact:true})).toBeVisible();
});
test('provider has calendar inputs and owns cohort closure',async({page})=>{
 await login(page,'provider');await expect(page.getByRole('heading',{name:'Good morning, Thandi'})).toBeVisible();await page.goto('/(provider)/programmes');
 await expect(page.getByLabel('Lesson date and time',{exact:true})).toHaveAttribute('type','datetime-local');await expect(page.getByText('Lesson date and time (SAST)',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create programme',exact:true}).click();await expect(page.getByLabel('Start date (YYYY-MM-DD)',{exact:true})).toHaveAttribute('type','date');
 await expect(page.getByRole('button',{name:'Close cohort',exact:true})).toBeVisible();await page.screenshot({path:'test-results/provider-dates-'+test.info().project.name+'.png',fullPage:true});
});
test('QA rejection is enabled by any nonempty message without selecting files',async({page})=>{
 await login(page,'qa');await page.getByRole('button',{name:'Review audit →',exact:true}).first().click();
 const reject=page.getByRole('button',{name:'Reject / Request Re-upload',exact:true}).last();await expect(reject).toBeDisabled();await page.getByLabel('Reason for rejection or suspension recommendation',{exact:true}).fill('Fix');await expect(reject).toBeEnabled();await reject.click();await expect(page.getByText('Provider notified of required corrections.',{exact:true})).toBeVisible();
});
