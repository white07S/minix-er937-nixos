# A minimal headless NixOS host for the MINIX ER937-AI.
# This is the configuration the published results were measured on, with the
# keys and identifiers replaced by placeholders. Three things to fill in:
#   1. networking.hostId          (below)
#   2. the SSH public key         (below)
#   3. the disk's by-id path      (disk.nix)
{ pkgs, ... }:
{
  imports = [
    ./disk.nix
    ./hardware.nix
  ];

  networking.hostName = "er937";
  # ZFS refuses to import a pool without a stable host ID.
  # Generate your own: head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n'
  networking.hostId = "00000000";
  time.timeZone = "UTC";

  # --- Boot ---------------------------------------------------------------
  boot.loader.systemd-boot.enable = true;
  boot.loader.systemd-boot.configurationLimit = 10;
  boot.loader.efi.canTouchEfiVariables = true;

  # --- Storage ------------------------------------------------------------
  # Root is plain ext4 so the machine boots even if the pool has a problem.
  boot.supportedFilesystems = [ "zfs" ];
  boot.zfs.extraPools = [ "tank" ];
  boot.zfs.forceImportRoot = false;
  # Cap the ZFS cache so it does not compete with virtual machines for RAM.
  boot.kernelParams = [ "zfs.zfs_arc_max=4294967296" ];
  services.zfs.autoScrub.enable = true;
  services.zfs.trim.enable = true;
  services.fstrim.enable = true;
  zramSwap.enable = true;

  # --- Network ------------------------------------------------------------
  # DHCP on whichever of the two 2.5 GbE ports has a cable.
  networking.useDHCP = false;
  networking.useNetworkd = true;
  systemd.network.networks."10-wired" = {
    matchConfig.Name = "en*";
    networkConfig.DHCP = "yes";
  };
  systemd.network.wait-online.anyInterface = true;
  services.resolved.enable = true;

  networking.nftables.enable = true; # Incus on NixOS requires nftables
  networking.firewall.enable = true; # only SSH is open
  networking.firewall.trustedInterfaces = [ "incusbr0" ];

  # --- Access -------------------------------------------------------------
  # Keys only, no password anywhere. Recovery without network: pick an older
  # generation in the boot menu, or boot the installer stick.
  users.mutableUsers = false;
  users.users.admin = {
    isNormalUser = true;
    extraGroups = [
      "wheel"
      "incus-admin"
    ];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 REPLACE_WITH_YOUR_PUBLIC_KEY you@example"
    ];
  };
  security.sudo.wheelNeedsPassword = false;

  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
      PermitRootLogin = "no";
    };
  };

  # --- Incus (optional; delete this block if you do not want it) -----------
  virtualisation.incus = {
    enable = true;
    preseed = {
      networks = [
        {
          name = "incusbr0";
          type = "bridge";
          config = {
            "ipv4.address" = "10.10.10.1/24";
            "ipv4.nat" = "true";
            "ipv6.address" = "none";
          };
        }
      ];
      storage_pools = [
        {
          name = "default";
          driver = "zfs";
          config.source = "tank/incus";
        }
      ];
      profiles = [
        {
          name = "default";
          devices = {
            eth0 = {
              name = "eth0";
              network = "incusbr0";
              type = "nic";
            };
            root = {
              path = "/";
              pool = "default";
              type = "disk";
            };
          };
        }
      ];
    };
  };

  # --- Housekeeping -------------------------------------------------------
  nix.settings.experimental-features = [
    "nix-command"
    "flakes"
  ];
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };
  services.journald.extraConfig = "SystemMaxUse=1G";

  environment.systemPackages = with pkgs; [
    git
    htop
    lm_sensors
    nvme-cli
    pciutils
    smartmontools
    tmux
    vim
  ];

  system.stateVersion = "26.05";
}
