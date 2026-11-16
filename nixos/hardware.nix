# Hardware facts for the MINIX ER937-AI. Matches what
# `nixos-generate-config --show-hardware-config` detects on this machine (NixOS 26.05).
{
  nixpkgs.hostPlatform = "x86_64-linux";

  boot.initrd.availableKernelModules = [
    "nvme"
    "xhci_pci"
    "thunderbolt"
    "usbhid"
    "uas"
    "usb_storage"
    "sd_mod"
  ];
  boot.kernelModules = [ "kvm-amd" ];

  hardware.cpu.amd.updateMicrocode = true;
  # Firmware for the Radeon graphics, the Realtek network ports, the MediaTek
  # Wi-Fi/Bluetooth card and the NPU.
  hardware.enableRedistributableFirmware = true;
}
