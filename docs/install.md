# Installing NixOS on the MINIX ER937-AI

What was done on 2026-11-16 with NixOS 26.05, written as steps. **Step 6 erases the internal
disk.** You need a USB stick, a wired network connection, and a second computer to work from.
A monitor and keyboard are needed only for steps 1 and 2.

## Before you start

Edit the three placeholders in [`../nixos/`](../nixos/):

| File | Placeholder | Replace with |
|---|---|---|
| `configuration.nix` | `networking.hostId = "00000000"` | Eight random hex digits |
| `configuration.nix` | `ssh-ed25519 REPLACE_WITH_YOUR_PUBLIC_KEY …` | Your SSH public key |
| `disk.nix` | `/dev/disk/by-id/REPLACE-WITH-YOUR-DISK-ID` | Your disk's id (you can read it in step 4) |

There is no password in this configuration. If the key is wrong you cannot log in, and recovery
means booting the installer stick again.

## Steps

1. **BIOS.** Turn Secure Boot off (Security tab) and put USB first in the boot order (Boot tab).
   See the README for how to get into the BIOS.
2. **Boot the installer.** Write the NixOS minimal ISO to a stick, boot it, and choose the
   **Linux LTS** entry: the installer only carries ZFS for the LTS kernel. At the prompt run
   `passwd` to set a temporary password for the `nixos` user.
3. **Log in from your other computer** and install your key, so the rest needs no password:
   ```sh
   ssh-copy-id nixos@<address>
   ssh nixos@<address>
   ```
4. **Check the hardware and find the disk id:**
   ```sh
   nixos-generate-config --show-hardware-config --no-filesystems
   ls -l /dev/disk/by-id/ | grep nvme
   ```
   The first command should match [`../nixos/hardware.nix`](../nixos/hardware.nix).
5. **Copy this repository to the installer and build it before touching the disk.** A failed
   build stops here with nothing changed.
   ```sh
   # on your computer
   rsync -a --exclude .git ./ nixos@<address>:er937/
   # on the installer
   nix --extra-experimental-features 'nix-command flakes' build \
     ./er937#nixosConfigurations.er937.config.system.build.toplevel
   ```
6. **Partition, format and mount. This erases the disk.**
   ```sh
   sudo nix --extra-experimental-features 'nix-command flakes' run github:nix-community/disko/latest -- \
     --mode destroy,format,mount --yes-wipe-all-disks --flake ./er937#er937
   ```
7. **Install, then unmount and export the pool** so the installed system can import it cleanly:
   ```sh
   sudo nixos-install --flake ./er937#er937 --no-root-passwd --no-channel-copy
   sudo umount -R /mnt && sudo zpool export tank
   sudo poweroff
   ```
8. **Pull the stick out while the machine is off**, then power it on. This firmware boots a
   plugged-in stick even when the internal disk is first in the boot order.
9. **Log in** as `admin` with your key. The address may differ from the installer's, and it
   differs between the two network ports.
   ```sh
   ssh admin@<address> 'hostname; zpool status -x; systemctl --failed'
   ```

On the first run the build and the install each took about a minute on a fast connection.

## What went wrong the first time

- After `reboot` with the stick still in, the machine booted the installer again. Pulling the
  stick from the running installer then broke it, because the installer runs from the stick, and
  the machine had to be power-cycled. Steps 7 and 8 avoid this.
- The cable was moved to the other network port, and the router gave the machine a different
  address, because each port has its own hardware address.
