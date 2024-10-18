---
layout: post
title: Installing FreeDOS on a Neoware EON using Qemu
description:
summary:
tags: [neoware eon, freedos, qemu]
---

In this post, I will describe the process of installing FreeDOS onto the drive of a Neoware EON. The [Neoware EON](https://www.parkytowers.me.uk/thin/neoware/Eon/) is a thin client featuring a [Geode GX-1](https://www.cpu-world.com/CPUs/GX1/index.html) CPU, which is comparable in power to a Pentium I. I use this device for DOS (VGA) retro game and demo development. Ultimately, my goal is to acquire a collection of old retro devices (80[1,2,3,4]86) to test developed software.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/neoware-eon.jpg" />
</p>

The EON originally comes with a 16 MB DiskOnModule IDE drive. Although this capacity is generally sufficient for running FreeDOS and the developed software, I found it inconvenient to install an operating system (in this case, FreeDOS) because the device cannot boot from USB.

To address this limitation, I installed an SD35VC0, an SD to IDE adapter that can be plugged into the 40-pin IDE slot of the EON. Be sure to provide power to the adapter, which can be done using a Molex connector (or a FDD connector).

Now that the EON can use an SD card as its drive, we can proceed with installing an operating system. However, we still face the limitation of not being able to boot from USB.

Therefore, we will use QEMU to run the FreeDOS Live-CD and install it to a raw image in a virtual machine. This image can then be written to the SD card.

# Download the FreeDOS Live-CD

First, we need to download the FreeDOS Live-CD, which will be used to install FreeDOS onto a drive within QEMU. You can obtain the FreeDOS Live-CD from the official website [here](https://freedos.org/download/).

# Creating the HDD image

Next, we will create an image that represents the QEMU drive where FreeDOS will be installed. This image will later be written to an SD card. By not specifying the image type, we will create a raw image. In this case, we will create an image with a size of 14 GB.

{% highlight console %}
$ qemu-img create freedos.img 14G
{% endhighlight %}

# Booting the FreeDOS Live-CD in Qemu

rBy utilizing the image created in the previous step as a virtual drive, we can simultaneously boot from the FreeDOS Live-CD while installing FreeDOS onto the drive, effectively writing it to the created image.

To boot the FreeDOS Live-CD, use the following command:

{% highlight console %}
$ qemu-system-i386 -enable-kvm -drive format=raw,file=freedos.img -m 128 -cdrom FD13LIVE.iso -boot order=d
{% endhighlight %}

## Command breakdown

- **-enable-kvm**: Enables KVM (Kernel-based Virtual Machine) for improved performance when running virtual machines on Linux.
- **-drive format=raw,file=freedos.img**: Specifies a virtual disk drive with a raw image format, using the image name _freedos.img_.
- **-m 128**: Sets the amount of memory allocated to the virtual machine.
- **-cdrom FD13LIVE.iso**: Specifies the CD-ROM drive for the virtual machine, pointing to the FreeDOS Live-CD ISO.
- **-boot order=d**: Indicates that the VM should boot from the CD-ROM drive.

For a more detailed description of QEMU options, visit the [official documentation](https://www.qemu.org/docs/master/system/index.html).

## Installing FreeDOS

Next, we proceed with installing FreeDOS inside the virtual machine. Note that only the essential steps are shown here; the subsequent steps are straightforward.

First, select the option to install to the hard disk (which, as a reminder, refers to the image we provided).

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/1-boot.jpg" />
</p>

Next, we will partition the drive.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/2-partition.jpg" />
</p>

After partitioning, you will need to reboot the virtual machine.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/3-reboot.jpg" />
</p>

Once the virtual machine has rebooted, indicate that you want to install to the hard disk again.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/4-reboot.jpg" />
</p>

Now, format the drive.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/5-format.jpg" />
</p>

The formatting process should complete successfully.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/6-format.jpg" />
</p>

Next, we will overwrite the MBR (Master Boot Record) of the drive.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/7-mbr.jpg" />
</p>

Now, we can proceed to install FreeDOS. Depending on your intended use, you can select different options for installation. Keep in mind that a full installation includes additional software that may not be necessary.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/8-install.jpg" />
</p>

The installation process will commence.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/9-installing.jpg" />
</p>

After the installation completes, you can stop the virtual machine.

# Writing the image to SD-card

To identify the block device corresponding to our SD card, we can use the following command:

{% highlight console %}
$ lsblk
{% endhighlight %}

In our case, the output displays the following block devices.

<!-- prettier-ignore-start -->
```
NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
mmcblk0     179:0    0  14,8G  0 disk
└─mmcblk0p1 179:1    0  14,8G  0 part
nvme0n1     259:0    0   1,8T  0 disk
├─nvme0n1p1 259:1    0   100M  0 part /boot/efi
├─nvme0n1p2 259:2    0    16M  0 part
├─nvme0n1p3 259:3    0 885,7G  0 part
├─nvme0n1p4 259:4    0   652M  0 part
└─nvme0n1p5 259:5    0 976,6G  0 part /
```
<!-- prettier-ignore-end -->

Here, _mmcblk0_ represents our SD card, which has a capacity of 14.8 GB (marketed as 16 GB — hurray for marketing). The device contains one partition, _p1_. To prepare the device for receiving our FreeDOS image, we will need to configure it using _fdisk_:

{% highlight console %}
$ fdisk /dev/mmcblk0
{% endhighlight %}

Follow these steps:

1. Check the current partitions by using the `p` command.
2. Delete the existing partition by using the `d` command.
3. Create a new partition by using the `n` command.
4. Set the partition type by using the `t` command.
5. Mark the partition as bootable by using the `a` command.
6. Write all pending changes by using the `w` command.

You can observe the entire process in the following output:

<!-- prettier-ignore-start -->
```
Welcome to fdisk (util-linux 2.40.2).
Changes will remain in memory only, until you decide to write them.
Be careful before using the write command.


Command (m for help): p
Disk /dev/mmcblk0: 14,84 GiB, 15931539456 bytes, 31116288 sectors
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disklabel type: dos
Disk identifier: 0xbf201408

Device         Boot Start      End  Sectors Size Id Type
/dev/mmcblk0p1 *     2048 29362175 29360128  14G 83 Linux

Command (m for help): d
Selected partition 1
Partition 1 has been deleted.

Command (m for help): n
Partition type
   p   primary (0 primary, 0 extended, 4 free)
   e   extended (container for logical partitions)
Select (default p): p
Partition number (1-4, default 1):
First sector (2048-31116287, default 2048):
Last sector, +/-sectors or +/-size{K,M,G,T,P} (2048-31116287, default 31116287): +14G

Created a new partition 1 of type 'Linux' and of size 14 GiB.
Partition #1 contains a vfat signature.

Do you want to remove the signature? [Y]es/[N]o: y

The signature will be removed by a write command.

Command (m for help): t
Selected partition 1
Hex code or alias (type L to list all): L

00 Empty            27 Hidden NTFS Win  82 Linux swap / So  c1 DRDOS/sec (FAT-
01 FAT12            39 Plan 9           83 Linux            c4 DRDOS/sec (FAT-
02 XENIX root       3c PartitionMagic   84 OS/2 hidden or   c6 DRDOS/sec (FAT-
03 XENIX usr        40 Venix 80286      85 Linux extended   c7 Syrinx
04 FAT16 <32M       41 PPC PReP Boot    86 NTFS volume set  da Non-FS data
05 Extended         42 SFS              87 NTFS volume set  db CP/M / CTOS / .
06 FAT16            4d QNX4.x           88 Linux plaintext  de Dell Utility
07 HPFS/NTFS/exFAT  4e QNX4.x 2nd part  8e Linux LVM        df BootIt
08 AIX              4f QNX4.x 3rd part  93 Amoeba           e1 DOS access
09 AIX bootable     50 OnTrack DM       94 Amoeba BBT       e3 DOS R/O
0a OS/2 Boot Manag  51 OnTrack DM6 Aux  9f BSD/OS           e4 SpeedStor
0b W95 FAT32        52 CP/M             a0 IBM Thinkpad hi  ea Linux extended
0c W95 FAT32 (LBA)  53 OnTrack DM6 Aux  a5 FreeBSD          eb BeOS fs
0e W95 FAT16 (LBA)  54 OnTrackDM6       a6 OpenBSD          ee GPT
0f W95 Ext'd (LBA)  55 EZ-Drive         a7 NeXTSTEP         ef EFI (FAT-12/16/
10 OPUS             56 Golden Bow       a8 Darwin UFS       f0 Linux/PA-RISC b
11 Hidden FAT12     5c Priam Edisk      a9 NetBSD           f1 SpeedStor
12 Compaq diagnost  61 SpeedStor        ab Darwin boot      f4 SpeedStor
14 Hidden FAT16 <3  63 GNU HURD or Sys  af HFS / HFS+       f2 DOS secondary
16 Hidden FAT16     64 Novell Netware   b7 BSDI fs          f8 EBBR protective
17 Hidden HPFS/NTF  65 Novell Netware   b8 BSDI swap        fb VMware VMFS
18 AST SmartSleep   70 DiskSecure Mult  bb Boot Wizard hid  fc VMware VMKCORE
1b Hidden W95 FAT3  75 PC/IX            bc Acronis FAT32 L  fd Linux raid auto
1c Hidden W95 FAT3  80 Old Minix        be Solaris boot     fe LANstep
1e Hidden W95 FAT1  81 Minix / old Lin  bf Solaris          ff BBT
24 NEC DOS

Aliases:
   linux          - 83
   swap           - 82
   extended       - 05
   uefi           - EF
   raid           - FD
   lvm            - 8E
   linuxex        - 85
Hex code or alias (type L to list all): 0b
Changed type of partition 'Linux' to 'W95 FAT32'.

Command (m for help): a
Selected partition 1
The bootable flag on partition 1 is enabled now.

Command (m for help): w
The partition table has been altered.
Calling ioctl() to re-read partition table.
Syncing disks.
```
<!-- prettier-ignore-end -->

Next, we will format the partition as FAT32 using the following command:

{% highlight console %}
$ mkfs.fat -F 32 /dev/mmcblk0p1
{% endhighlight %}

Finally, we will write the created image to the SD card with the following command:

{% highlight console %}
$ dd if=freedos.img of=/dev/mmcblk0 bs=4M status=progress
$ sync
{% endhighlight %}

Note that this can take a while.

# Booting on the EON

Finally, we insert the SD card into the adapter and boot up the Neoware EON to launch FreeDOS.

<p align="center">
<img width="800px" alt="Neoware EON" src="/assets/images/posts/freedos/dos-on-neoware-eon.jpg" />
</p>

Which successfully boots FreeDOS!
