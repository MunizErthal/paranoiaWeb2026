import { Injectable } from "@angular/core";
import { ToastrService } from 'ngx-toastr';

@Injectable({
	providedIn: 'root'
})
export class ToastService {
    constructor(private toast: ToastrService) { }

    showError(message: string) {
        this.toast.error(message, '', {
            closeButton: true,
            progressBar: true,
            toastClass: 'ngx-toastr glitchToastAnimation'
        });
    }

    showSuccess(message: string) {
        this.toast.success(message, '', {
            closeButton: true,
            progressBar: true,
            toastClass: 'ngx-toastr glitchToastAnimation'
        });
    }

    showInfo(message: string) {
        this.toast.info(message, '', {
            closeButton: true,
            progressBar: true,
            toastClass: 'ngx-toastr glitchToastAnimation'
        });
    }
}