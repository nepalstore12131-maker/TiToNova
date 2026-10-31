import {redirect} from 'next/navigation';

// Services have been retired. Existing tracked work remains in My work.
export default function RetiredServicePage(){
 redirect('/jobs');
}
