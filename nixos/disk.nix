# Disk layout, applied by disko at install time. That run erases the disk.
#
#   1 GB    EFI    /boot   boot loader and kernels
#   128 GB  ext4   /       the system; rebuildable from the configuration
#   rest    ZFS    tank    virtual machines, containers and data
{
  disko.devices = {
    disk.main = {
      type = "disk";
      # Replace with your disk's stable id: ls -l /dev/disk/by-id/ | grep nvme
      device = "/dev/disk/by-id/REPLACE-WITH-YOUR-DISK-ID";
      content = {
        type = "gpt";
        partitions = {
          ESP = {
            priority = 1;
            size = "1G";
            type = "EF00";
            content = {
              type = "filesystem";
              format = "vfat";
              mountpoint = "/boot";
              mountOptions = [ "umask=0077" ];
            };
          };
          root = {
            priority = 2;
            size = "128G";
            content = {
              type = "filesystem";
              format = "ext4";
              mountpoint = "/";
            };
          };
          tank = {
            priority = 3;
            size = "100%";
            content = {
              type = "zfs";
              pool = "tank";
            };
          };
        };
      };
    };

    zpool.tank = {
      type = "zpool";
      options = {
        ashift = "12";
        autotrim = "on";
      };
      rootFsOptions = {
        compression = "zstd";
        atime = "off";
        xattr = "sa";
        acltype = "posixacl";
        mountpoint = "none";
      };
      # Incus owns everything below this dataset.
      datasets.incus = {
        type = "zfs_fs";
        options.mountpoint = "none";
      };
    };
  };
}
