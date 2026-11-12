import QRCode from 'qrcode';
import {authenticator} from 'otplib';
export async function mfaPresentation(email:string,secret:string){
 const otpAuthUrl=authenticator.keyuri(email,'AgriProvider',secret);
 // Generate locally: never send a user's MFA secret to a remote QR service.
 return {secret,otpAuthUrl,qrDataUrl:await QRCode.toDataURL(otpAuthUrl,{width:280,margin:4,errorCorrectionLevel:'M'})};
}
