import {test as base,expect} from '@playwright/test';
// Keep repeated real login requests below the production limit of ten per minute.
export const test=base.extend<{loginPacing:void}>({loginPacing:[async({},use)=>{await new Promise(resolve=>setTimeout(resolve,6500));await use();},{auto:true}]});
export {expect};
